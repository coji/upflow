import SQLite from 'better-sqlite3'
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'
import * as cache from '~/app/services/cache.server'
import { closeDb, db } from '~/app/services/db.server'
import { processGithubWebhookPayload } from './github-webhook.server'

const testDir = path.join(tmpdir(), `github-webhook-${Date.now()}`)
mkdirSync(testDir, { recursive: true })
const testDbPath = path.join(testDir, 'data.db')
writeFileSync(testDbPath, '')

const rawInit = new SQLite(testDbPath)
rawInit.exec(`
  CREATE TABLE organizations (
    id text NOT NULL PRIMARY KEY,
    name text NOT NULL,
    slug text NOT NULL,
    logo text,
    metadata text,
    created_at text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
  );
  CREATE TABLE integrations (
    id text NOT NULL PRIMARY KEY,
    organization_id text NOT NULL,
    provider text NOT NULL DEFAULT 'github',
    method text NOT NULL DEFAULT 'token',
    private_token text,
    app_suspended_at text,
    created_at text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    CONSTRAINT integrations_organization_id_fkey
      FOREIGN KEY (organization_id) REFERENCES organizations(id)
      ON UPDATE CASCADE ON DELETE CASCADE
  );
  CREATE UNIQUE INDEX integrations_organization_id_key ON integrations (organization_id);
  CREATE TABLE github_app_links (
    organization_id text NOT NULL PRIMARY KEY,
    installation_id integer NOT NULL,
    github_account_id integer NOT NULL,
    github_org text NOT NULL,
    app_repository_selection text NOT NULL DEFAULT 'all',
    deleted_at text,
    created_at text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    CONSTRAINT github_app_links_organization_id_fkey
      FOREIGN KEY (organization_id) REFERENCES organizations(id)
      ON UPDATE CASCADE ON DELETE CASCADE
  );
  CREATE UNIQUE INDEX github_app_links_installation_id_key ON github_app_links (installation_id);
  CREATE UNIQUE INDEX github_app_links_github_account_id_key ON github_app_links (github_account_id);
`)
rawInit.close()

vi.stubEnv('UPFLOW_DATA_DIR', path.dirname(testDbPath))

describe('processGithubWebhookPayload', () => {
  const clearSpy = vi.spyOn(cache, 'clearOrgCache')

  afterAll(async () => {
    await closeDb()
    vi.unstubAllEnvs()
  })

  afterEach(() => {
    clearSpy.mockClear()
  })

  beforeEach(async () => {
    await closeDb()
    const raw = new SQLite(testDbPath)
    raw.exec(
      'DELETE FROM github_app_links; DELETE FROM integrations; DELETE FROM organizations;',
    )
    raw.close()

    await db
      .insertInto('organizations')
      .values({
        id: 'o1',
        name: 'Org One',
        slug: 'org-one',
        logo: null,
        metadata: null,
      })
      .execute()
    await db
      .insertInto('integrations')
      .values({
        id: 'int1',
        organizationId: 'o1',
        provider: 'github',
        method: 'github_app',
        privateToken: null,
        appSuspendedAt: null,
      })
      .execute()
    await db
      .insertInto('githubAppLinks')
      .values({
        organizationId: 'o1',
        installationId: 42,
        githubAccountId: 99,
        githubOrg: 'old-login',
        appRepositorySelection: 'all',
        deletedAt: null,
      })
      .execute()
  })

  test('installation.created updates link when matched', async () => {
    await processGithubWebhookPayload('installation', {
      action: 'created',
      installation: {
        id: 42,
        account: { id: 99, login: 'new-login' },
        repository_selection: 'selected',
      },
    })

    const row = await db
      .selectFrom('githubAppLinks')
      .selectAll()
      .where('organizationId', '=', 'o1')
      .executeTakeFirstOrThrow()

    expect(row.githubOrg).toBe('new-login')
    expect(row.appRepositorySelection).toBe('selected')
    expect(row.installationId).toBe(42)
    expect(clearSpy).toHaveBeenCalledWith('o1')
  })

  test('installation.created with no matching link does not throw', async () => {
    await expect(
      processGithubWebhookPayload('installation', {
        action: 'created',
        installation: {
          id: 999,
          account: { id: 888, login: 'x' },
        },
      }),
    ).resolves.toBeUndefined()
    expect(clearSpy).not.toHaveBeenCalled()
  })

  test('installation.deleted soft-deletes link', async () => {
    await processGithubWebhookPayload('installation', {
      action: 'deleted',
      installation: { id: 42 },
    })

    const row = await db
      .selectFrom('githubAppLinks')
      .select(['deletedAt'])
      .where('organizationId', '=', 'o1')
      .executeTakeFirstOrThrow()

    expect(row.deletedAt).not.toBeNull()
    expect(clearSpy).toHaveBeenCalledWith('o1')
  })

  test('installation.suspend sets appSuspendedAt', async () => {
    await processGithubWebhookPayload('installation', {
      action: 'suspend',
      installation: { id: 42 },
    })

    const row = await db
      .selectFrom('integrations')
      .select('appSuspendedAt')
      .where('organizationId', '=', 'o1')
      .executeTakeFirstOrThrow()

    expect(row.appSuspendedAt).not.toBeNull()
    expect(clearSpy).toHaveBeenCalledWith('o1')
  })

  test('installation.unsuspend clears appSuspendedAt', async () => {
    await db
      .updateTable('integrations')
      .set({ appSuspendedAt: '2026-01-01T00:00:00Z' })
      .where('organizationId', '=', 'o1')
      .execute()

    await processGithubWebhookPayload('installation', {
      action: 'unsuspend',
      installation: { id: 42 },
    })

    const row = await db
      .selectFrom('integrations')
      .select('appSuspendedAt')
      .where('organizationId', '=', 'o1')
      .executeTakeFirstOrThrow()

    expect(row.appSuspendedAt).toBeNull()
  })

  test('installation_repositories updates selection', async () => {
    await processGithubWebhookPayload('installation_repositories', {
      installation: {
        id: 42,
        repository_selection: 'selected',
      },
    })

    const row = await db
      .selectFrom('githubAppLinks')
      .select('appRepositorySelection')
      .where('organizationId', '=', 'o1')
      .executeTakeFirstOrThrow()

    expect(row.appRepositorySelection).toBe('selected')
  })

  test('ping event is ignored', async () => {
    await processGithubWebhookPayload('ping', { zen: 'x' })
    expect(clearSpy).not.toHaveBeenCalled()
  })
})
