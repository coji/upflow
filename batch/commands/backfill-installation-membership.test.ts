import SQLite from 'better-sqlite3'
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'
import { closeDb, db } from '~/app/services/db.server'
import { closeAllTenantDbs, getTenantDb } from '~/app/services/tenant-db.server'
import type { OrganizationId } from '~/app/types/organization'

type ApiRepo = { owner: string; name: string }
const fetchInstallationRepositoriesMock = vi.fn<() => Promise<ApiRepo[]>>(
  async () => [],
)
vi.mock('~/app/services/github-installation-repos.server', () => ({
  fetchInstallationRepositories: () => fetchInstallationRepositoriesMock(),
}))

const testDir = path.join(tmpdir(), `backfill-membership-${Date.now()}`)
mkdirSync(testDir, { recursive: true })
const sharedDbPath = path.join(testDir, 'data.db')
writeFileSync(sharedDbPath, '')

const setupSharedDb = () => {
  const sql = new SQLite(sharedDbPath)
  sql.exec(`
    CREATE TABLE organizations (
      id text NOT NULL PRIMARY KEY,
      name text NOT NULL,
      slug text NOT NULL
    );
    CREATE TABLE integrations (
      id text NOT NULL PRIMARY KEY,
      organization_id text NOT NULL,
      provider text NOT NULL DEFAULT 'github',
      method text NOT NULL DEFAULT 'token',
      private_token text,
      app_suspended_at text,
      created_at text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
      updated_at text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    );
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
  sql.close()
}
setupSharedDb()

const ensureTenantDbFile = (orgId: OrganizationId) => {
  const tenantDbPath = path.join(testDir, `tenant_${orgId}.db`)
  writeFileSync(tenantDbPath, '')
  const sql = new SQLite(tenantDbPath)
  sql.exec(`
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
  sql.close()
}

vi.stubEnv('UPFLOW_DATA_DIR', testDir)

const SINGLE_ORG = 'org-single' as OrganizationId
const MULTI_ORG = 'org-multi' as OrganizationId
const TOKEN_ORG = 'org-token' as OrganizationId
ensureTenantDbFile(SINGLE_ORG)
ensureTenantDbFile(MULTI_ORG)
ensureTenantDbFile(TOKEN_ORG)

const insertOrg = async (id: string, method: 'token' | 'github_app') => {
  await db
    .insertInto('organizations')
    .values({ id, name: id, slug: id })
    .execute()
  await db
    .insertInto('integrations')
    .values({
      id: `int-${id}`,
      organizationId: id,
      provider: 'github',
      method,
      privateToken: null,
      appSuspendedAt: null,
    })
    .execute()
}

const insertLink = async (orgId: string, installationId: number) => {
  await db
    .insertInto('githubAppLinks')
    .values({
      organizationId: orgId,
      installationId,
      githubAccountId: installationId,
      githubAccountType: 'Organization',
      githubOrg: `org-${installationId}`,
      appRepositorySelection: 'all',
      suspendedAt: null,
      membershipInitializedAt: '2026-04-07T00:00:00Z',
      deletedAt: null,
    })
    .execute()
}

const insertRepo = async (orgId: OrganizationId, id: string) => {
  const tenantDb = getTenantDb(orgId)
  await tenantDb
    .insertInto('repositories')
    .values({
      id,
      integrationId: `int-${orgId}`,
      provider: 'github',
      owner: 'octo',
      repo: id,
      githubInstallationId: null,
      updatedAt: '2026-04-07T00:00:00Z',
    })
    .execute()
}

describe('backfillInstallationMembershipCommand', () => {
  beforeAll(async () => {
    await db.selectFrom('organizations').select('id').execute()
  })

  afterAll(async () => {
    await closeAllTenantDbs()
    await closeDb()
  })

  beforeEach(async () => {
    await db.deleteFrom('githubAppLinkEvents').execute()
    await db.deleteFrom('githubAppLinks').execute()
    await db.deleteFrom('integrations').execute()
    await db.deleteFrom('organizations').execute()
    for (const id of [SINGLE_ORG, MULTI_ORG, TOKEN_ORG]) {
      const tenantDb = getTenantDb(id)
      await tenantDb.deleteFrom('repositoryInstallationMemberships').execute()
      await tenantDb.deleteFrom('repositories').execute()
    }
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('single active link → backfills repos and memberships', async () => {
    await insertOrg(SINGLE_ORG, 'github_app')
    await insertLink(SINGLE_ORG, 100)
    await insertRepo(SINGLE_ORG, 'repo-1')
    await insertRepo(SINGLE_ORG, 'repo-2')
    fetchInstallationRepositoriesMock.mockResolvedValueOnce([
      { owner: 'octo', name: 'repo-1' },
      { owner: 'octo', name: 'repo-2' },
    ])

    const { backfillInstallationMembershipCommand } =
      await import('./backfill-installation-membership')
    await backfillInstallationMembershipCommand({
      organizationId: SINGLE_ORG,
    })

    const tenantDb = getTenantDb(SINGLE_ORG)
    const repos = await tenantDb
      .selectFrom('repositories')
      .select(['id', 'githubInstallationId'])
      .execute()
    expect(repos.every((r) => r.githubInstallationId === 100)).toBe(true)

    const memberships = await tenantDb
      .selectFrom('repositoryInstallationMemberships')
      .select(['repositoryId', 'installationId'])
      .execute()
    expect(memberships).toHaveLength(2)
    expect(memberships.every((m) => m.installationId === 100)).toBe(true)
  })

  test('GitHub API failure falls back to orphan-only membership upsert', async () => {
    await insertOrg(SINGLE_ORG, 'github_app')
    await insertLink(SINGLE_ORG, 100)
    await insertRepo(SINGLE_ORG, 'repo-fallback')
    fetchInstallationRepositoriesMock.mockRejectedValueOnce(
      new Error('GitHub API down'),
    )

    const { backfillInstallationMembershipCommand } =
      await import('./backfill-installation-membership')
    await backfillInstallationMembershipCommand({
      organizationId: SINGLE_ORG,
    })

    const tenantDb = getTenantDb(SINGLE_ORG)
    const repos = await tenantDb
      .selectFrom('repositories')
      .select('githubInstallationId')
      .execute()
    expect(repos.every((r) => r.githubInstallationId === 100)).toBe(true)

    const memberships = await tenantDb
      .selectFrom('repositoryInstallationMemberships')
      .select(['repositoryId', 'installationId'])
      .execute()
    expect(memberships).toHaveLength(1)
    expect(memberships[0].installationId).toBe(100)
  })

  test('token method → skipped, no writes', async () => {
    await insertOrg(TOKEN_ORG, 'token')
    await insertRepo(TOKEN_ORG, 'repo-x')

    const { backfillInstallationMembershipCommand } =
      await import('./backfill-installation-membership')
    await backfillInstallationMembershipCommand({
      organizationId: TOKEN_ORG,
    })

    const tenantDb = getTenantDb(TOKEN_ORG)
    const repo = await tenantDb
      .selectFrom('repositories')
      .select('githubInstallationId')
      .where('id', '=', 'repo-x')
      .executeTakeFirstOrThrow()
    expect(repo.githubInstallationId).toBeNull()
  })

  test('multi active link → not backfilled, repo stays NULL', async () => {
    await insertOrg(MULTI_ORG, 'github_app')
    await insertLink(MULTI_ORG, 200)
    await insertLink(MULTI_ORG, 201)
    await insertRepo(MULTI_ORG, 'repo-y')

    const { backfillInstallationMembershipCommand } =
      await import('./backfill-installation-membership')
    await backfillInstallationMembershipCommand({
      organizationId: MULTI_ORG,
    })

    const tenantDb = getTenantDb(MULTI_ORG)
    const repo = await tenantDb
      .selectFrom('repositories')
      .select('githubInstallationId')
      .where('id', '=', 'repo-y')
      .executeTakeFirstOrThrow()
    expect(repo.githubInstallationId).toBeNull()
  })

  test('dry-run does not write or call GitHub API', async () => {
    await insertOrg(SINGLE_ORG, 'github_app')
    await insertLink(SINGLE_ORG, 300)
    await insertRepo(SINGLE_ORG, 'repo-dry')
    fetchInstallationRepositoriesMock.mockClear()

    const { backfillInstallationMembershipCommand } =
      await import('./backfill-installation-membership')
    await backfillInstallationMembershipCommand({
      organizationId: SINGLE_ORG,
      dryRun: true,
    })

    const tenantDb = getTenantDb(SINGLE_ORG)
    const repo = await tenantDb
      .selectFrom('repositories')
      .select('githubInstallationId')
      .where('id', '=', 'repo-dry')
      .executeTakeFirstOrThrow()
    expect(repo.githubInstallationId).toBeNull()
    expect(fetchInstallationRepositoriesMock).not.toHaveBeenCalled()
  })

  test('idempotent: re-running on already-backfilled rows is a no-op', async () => {
    await insertOrg(SINGLE_ORG, 'github_app')
    await insertLink(SINGLE_ORG, 100)
    await insertRepo(SINGLE_ORG, 'repo-1')
    fetchInstallationRepositoriesMock.mockResolvedValue([
      { owner: 'octo', name: 'repo-1' },
    ])

    const { backfillInstallationMembershipCommand } =
      await import('./backfill-installation-membership')
    await backfillInstallationMembershipCommand({
      organizationId: SINGLE_ORG,
    })
    await backfillInstallationMembershipCommand({
      organizationId: SINGLE_ORG,
    })

    const tenantDb = getTenantDb(SINGLE_ORG)
    const memberships = await tenantDb
      .selectFrom('repositoryInstallationMemberships')
      .select(['repositoryId', 'installationId'])
      .execute()
    expect(memberships).toHaveLength(1)
  })

  test('re-seeds memberships for repos that already have githubInstallationId but missing memberships', async () => {
    await insertOrg(SINGLE_ORG, 'github_app')
    await insertLink(SINGLE_ORG, 100)
    // Insert a repo with githubInstallationId already set — so orphans is empty.
    await getTenantDb(SINGLE_ORG)
      .insertInto('repositories')
      .values({
        id: 'repo-preset',
        integrationId: 'int-integ',
        provider: 'github',
        owner: 'octo',
        repo: 'repo-preset',
        githubInstallationId: 100,
        updatedAt: '2026-04-07T00:00:00Z',
      })
      .execute()
    // memberships table is intentionally empty — previous seed failed.
    fetchInstallationRepositoriesMock.mockResolvedValueOnce([
      { owner: 'octo', name: 'repo-preset' },
    ])

    const { backfillInstallationMembershipCommand } =
      await import('./backfill-installation-membership')
    await backfillInstallationMembershipCommand({
      organizationId: SINGLE_ORG,
    })

    // Seed should have been called even though orphans was empty.
    expect(fetchInstallationRepositoriesMock).toHaveBeenCalled()

    const memberships = await getTenantDb(SINGLE_ORG)
      .selectFrom('repositoryInstallationMemberships')
      .select(['repositoryId', 'installationId'])
      .execute()
    expect(memberships).toHaveLength(1)
    expect(memberships[0]).toEqual({
      repositoryId: 'repo-preset',
      installationId: 100,
    })
  })
})
