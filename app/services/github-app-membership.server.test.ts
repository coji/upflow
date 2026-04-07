import SQLite from 'better-sqlite3'
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'
import { closeDb, db } from '~/app/services/db.server'
import { closeAllTenantDbs } from '~/app/services/tenant-db.server'
import type { OrganizationId } from '~/app/types/organization'
import { reassignCanonicalAfterLinkLoss } from './github-app-membership.server'

const ORG_ID = 'org-test' as OrganizationId
const LOST_INSTALLATION = 100
const ALT_INSTALLATION = 200
const SECOND_ALT_INSTALLATION = 300
const REPO_ID = 'repo-1'

const testDir = path.join(tmpdir(), `membership-${Date.now()}`)
mkdirSync(testDir, { recursive: true })
const sharedDbPath = path.join(testDir, 'data.db')
const tenantDbPath = path.join(testDir, `tenant_${ORG_ID}.db`)
writeFileSync(sharedDbPath, '')
writeFileSync(tenantDbPath, '')

const sharedInit = new SQLite(sharedDbPath)
sharedInit.exec(`
  CREATE TABLE github_app_links (
    organization_id text NOT NULL,
    installation_id integer NOT NULL,
    github_account_id integer NOT NULL,
    github_account_type text,
    github_org text NOT NULL,
    app_repository_selection text NOT NULL DEFAULT 'all',
    suspended_at text,
    membership_initialized_at text,
    deleted_at text,
    created_at text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    PRIMARY KEY (organization_id, installation_id)
  );
  CREATE TABLE github_app_link_events (
    id integer NOT NULL PRIMARY KEY AUTOINCREMENT,
    organization_id text NOT NULL,
    installation_id integer NOT NULL,
    event_type text NOT NULL,
    source text NOT NULL,
    status text NOT NULL,
    details_json text,
    created_at text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
  );
`)
sharedInit.close()

const tenantInit = new SQLite(tenantDbPath)
tenantInit.exec(`
  CREATE TABLE repositories (
    id text NOT NULL PRIMARY KEY,
    integration_id text NOT NULL,
    provider text NOT NULL,
    owner text NOT NULL,
    repo text NOT NULL,
    github_installation_id integer,
    release_detection_method text NOT NULL DEFAULT 'branch',
    release_detection_key text NOT NULL DEFAULT 'production',
    updated_at text NOT NULL,
    created_at text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    team_id text,
    scan_watermark text
  );
  CREATE TABLE repository_installation_memberships (
    repository_id text NOT NULL,
    installation_id integer NOT NULL,
    created_at text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    deleted_at text,
    PRIMARY KEY (repository_id, installation_id)
  );
`)
tenantInit.close()

vi.stubEnv('UPFLOW_DATA_DIR', testDir)

const insertLink = async (
  installationId: number,
  opts: {
    deletedAt?: string | null
    suspendedAt?: string | null
    membershipInitializedAt?: string | null
  } = {},
) => {
  await db
    .insertInto('githubAppLinks')
    .values({
      organizationId: ORG_ID,
      installationId,
      githubAccountId: installationId,
      githubOrg: `org-${installationId}`,
      githubAccountType: 'Organization',
      appRepositorySelection: 'all',
      suspendedAt: opts.suspendedAt ?? null,
      membershipInitializedAt:
        opts.membershipInitializedAt === undefined
          ? '2026-04-07T00:00:00Z'
          : opts.membershipInitializedAt,
      deletedAt: opts.deletedAt ?? null,
    })
    .execute()
}

const insertMembership = async (
  installationId: number,
  opts: { deletedAt?: string | null } = {},
) => {
  const { getTenantDb } = await import('~/app/services/tenant-db.server')
  const tenantDb = getTenantDb(ORG_ID)
  await tenantDb
    .insertInto('repositoryInstallationMemberships')
    .values({
      repositoryId: REPO_ID,
      installationId,
      deletedAt: opts.deletedAt ?? null,
    })
    .execute()
}

const seedRepository = async (canonicalInstallationId: number) => {
  const { getTenantDb } = await import('~/app/services/tenant-db.server')
  const tenantDb = getTenantDb(ORG_ID)
  await tenantDb
    .insertInto('repositories')
    .values({
      id: REPO_ID,
      integrationId: 'int-1',
      provider: 'github',
      owner: 'octo',
      repo: 'hello',
      githubInstallationId: canonicalInstallationId,
      updatedAt: '2026-04-07T00:00:00Z',
    })
    .execute()
}

describe('reassignCanonicalAfterLinkLoss', () => {
  beforeAll(async () => {
    // Force initial connection so subsequent stubEnv changes don't matter.
    await db.selectFrom('githubAppLinks').select('installationId').execute()
  })

  afterAll(async () => {
    await closeAllTenantDbs()
    await closeDb()
  })

  beforeEach(async () => {
    await db.deleteFrom('githubAppLinkEvents').execute()
    await db.deleteFrom('githubAppLinks').execute()
    const { getTenantDb } = await import('~/app/services/tenant-db.server')
    const tenantDb = getTenantDb(ORG_ID)
    await tenantDb.deleteFrom('repositoryInstallationMemberships').execute()
    await tenantDb.deleteFrom('repositories').execute()
  })

  test('1 eligible candidate → reassign + canonical_reassigned event', async () => {
    await insertLink(LOST_INSTALLATION, {
      deletedAt: '2026-04-07T00:00:00Z',
    })
    await insertLink(ALT_INSTALLATION)
    await seedRepository(LOST_INSTALLATION)
    await insertMembership(LOST_INSTALLATION)
    await insertMembership(ALT_INSTALLATION)

    await reassignCanonicalAfterLinkLoss({
      organizationId: ORG_ID,
      lostInstallationId: LOST_INSTALLATION,
      source: 'installation_webhook',
    })

    const { getTenantDb } = await import('~/app/services/tenant-db.server')
    const repo = await getTenantDb(ORG_ID)
      .selectFrom('repositories')
      .select('githubInstallationId')
      .where('id', '=', REPO_ID)
      .executeTakeFirstOrThrow()
    expect(repo.githubInstallationId).toBe(ALT_INSTALLATION)

    const events = await db
      .selectFrom('githubAppLinkEvents')
      .selectAll()
      .where('installationId', '=', LOST_INSTALLATION)
      .execute()
    expect(events).toHaveLength(1)
    expect(events[0].eventType).toBe('canonical_reassigned')
  })

  test('0 candidates → null + canonical_cleared event', async () => {
    await insertLink(LOST_INSTALLATION, {
      deletedAt: '2026-04-07T00:00:00Z',
    })
    await seedRepository(LOST_INSTALLATION)
    await insertMembership(LOST_INSTALLATION)

    await reassignCanonicalAfterLinkLoss({
      organizationId: ORG_ID,
      lostInstallationId: LOST_INSTALLATION,
      source: 'installation_webhook',
    })

    const { getTenantDb } = await import('~/app/services/tenant-db.server')
    const repo = await getTenantDb(ORG_ID)
      .selectFrom('repositories')
      .select('githubInstallationId')
      .where('id', '=', REPO_ID)
      .executeTakeFirstOrThrow()
    expect(repo.githubInstallationId).toBeNull()

    const events = await db
      .selectFrom('githubAppLinkEvents')
      .selectAll()
      .execute()
    expect(events.map((e) => e.eventType)).toEqual(['canonical_cleared'])
  })

  test('2+ candidates → null + assignment_required event', async () => {
    await insertLink(LOST_INSTALLATION, {
      deletedAt: '2026-04-07T00:00:00Z',
    })
    await insertLink(ALT_INSTALLATION)
    await insertLink(SECOND_ALT_INSTALLATION)
    await seedRepository(LOST_INSTALLATION)
    await insertMembership(LOST_INSTALLATION)
    await insertMembership(ALT_INSTALLATION)
    await insertMembership(SECOND_ALT_INSTALLATION)

    await reassignCanonicalAfterLinkLoss({
      organizationId: ORG_ID,
      lostInstallationId: LOST_INSTALLATION,
      source: 'installation_webhook',
    })

    const { getTenantDb } = await import('~/app/services/tenant-db.server')
    const repo = await getTenantDb(ORG_ID)
      .selectFrom('repositories')
      .select('githubInstallationId')
      .where('id', '=', REPO_ID)
      .executeTakeFirstOrThrow()
    expect(repo.githubInstallationId).toBeNull()

    const events = await db
      .selectFrom('githubAppLinkEvents')
      .selectAll()
      .execute()
    expect(events.map((e) => e.eventType)).toEqual(['assignment_required'])
  })

  test('uninitialized link present + 0 eligible candidates → assignment_required (not cleared)', async () => {
    await insertLink(LOST_INSTALLATION, {
      deletedAt: '2026-04-07T00:00:00Z',
    })
    await insertLink(ALT_INSTALLATION, { membershipInitializedAt: null })
    await seedRepository(LOST_INSTALLATION)
    await insertMembership(LOST_INSTALLATION)

    await reassignCanonicalAfterLinkLoss({
      organizationId: ORG_ID,
      lostInstallationId: LOST_INSTALLATION,
      source: 'installation_webhook',
    })

    const events = await db
      .selectFrom('githubAppLinkEvents')
      .selectAll()
      .execute()
    expect(events.map((e) => e.eventType)).toEqual(['assignment_required'])
  })

  test('suspended link is excluded from eligible candidates', async () => {
    await insertLink(LOST_INSTALLATION, {
      deletedAt: '2026-04-07T00:00:00Z',
    })
    await insertLink(ALT_INSTALLATION, {
      suspendedAt: '2026-04-07T00:00:00Z',
    })
    await seedRepository(LOST_INSTALLATION)
    await insertMembership(LOST_INSTALLATION)
    await insertMembership(ALT_INSTALLATION)

    await reassignCanonicalAfterLinkLoss({
      organizationId: ORG_ID,
      lostInstallationId: LOST_INSTALLATION,
      source: 'installation_webhook',
    })

    const { getTenantDb } = await import('~/app/services/tenant-db.server')
    const repo = await getTenantDb(ORG_ID)
      .selectFrom('repositories')
      .select('githubInstallationId')
      .where('id', '=', REPO_ID)
      .executeTakeFirstOrThrow()
    expect(repo.githubInstallationId).toBeNull()

    const events = await db
      .selectFrom('githubAppLinkEvents')
      .selectAll()
      .execute()
    expect(events.map((e) => e.eventType)).toEqual(['canonical_cleared'])
  })

  test('uninitialized link is excluded from eligible candidates', async () => {
    await insertLink(LOST_INSTALLATION, {
      deletedAt: '2026-04-07T00:00:00Z',
    })
    await insertLink(ALT_INSTALLATION, { membershipInitializedAt: null })
    await seedRepository(LOST_INSTALLATION)
    await insertMembership(LOST_INSTALLATION)
    await insertMembership(ALT_INSTALLATION)

    await reassignCanonicalAfterLinkLoss({
      organizationId: ORG_ID,
      lostInstallationId: LOST_INSTALLATION,
      source: 'installation_webhook',
    })

    const { getTenantDb } = await import('~/app/services/tenant-db.server')
    const repo = await getTenantDb(ORG_ID)
      .selectFrom('repositories')
      .select('githubInstallationId')
      .where('id', '=', REPO_ID)
      .executeTakeFirstOrThrow()
    expect(repo.githubInstallationId).toBeNull()

    const events = await db
      .selectFrom('githubAppLinkEvents')
      .selectAll()
      .execute()
    expect(events.map((e) => e.eventType)).toEqual(['assignment_required'])
  })

  test('soft-deleted membership is excluded from candidates', async () => {
    await insertLink(LOST_INSTALLATION, {
      deletedAt: '2026-04-07T00:00:00Z',
    })
    await insertLink(ALT_INSTALLATION)
    await seedRepository(LOST_INSTALLATION)
    await insertMembership(LOST_INSTALLATION)
    await insertMembership(ALT_INSTALLATION, {
      deletedAt: '2026-04-07T00:00:00Z',
    })

    await reassignCanonicalAfterLinkLoss({
      organizationId: ORG_ID,
      lostInstallationId: LOST_INSTALLATION,
      source: 'installation_webhook',
    })

    const events = await db
      .selectFrom('githubAppLinkEvents')
      .selectAll()
      .execute()
    expect(events.map((e) => e.eventType)).toEqual(['canonical_cleared'])
  })

  test('idempotent: running twice produces same final state', async () => {
    await insertLink(LOST_INSTALLATION, {
      deletedAt: '2026-04-07T00:00:00Z',
    })
    await insertLink(ALT_INSTALLATION)
    await seedRepository(LOST_INSTALLATION)
    await insertMembership(LOST_INSTALLATION)
    await insertMembership(ALT_INSTALLATION)

    await reassignCanonicalAfterLinkLoss({
      organizationId: ORG_ID,
      lostInstallationId: LOST_INSTALLATION,
      source: 'installation_webhook',
    })
    await reassignCanonicalAfterLinkLoss({
      organizationId: ORG_ID,
      lostInstallationId: LOST_INSTALLATION,
      source: 'installation_webhook',
    })

    const { getTenantDb } = await import('~/app/services/tenant-db.server')
    const repo = await getTenantDb(ORG_ID)
      .selectFrom('repositories')
      .select('githubInstallationId')
      .where('id', '=', REPO_ID)
      .executeTakeFirstOrThrow()
    // After first run repo points at ALT, second run finds nothing pointing
    // at LOST so does nothing → still ALT.
    expect(repo.githubInstallationId).toBe(ALT_INSTALLATION)

    const events = await db
      .selectFrom('githubAppLinkEvents')
      .selectAll()
      .execute()
    // Only the first run produces an event; the second run is a no-op.
    expect(events).toHaveLength(1)
  })
})
