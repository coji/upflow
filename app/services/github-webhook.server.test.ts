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

const mockTenantRepoLookup = vi.fn()

type Chain = {
  select: (..._args: unknown[]) => Chain
  where: (..._args: unknown[]) => Chain
  leftJoin: (..._args: unknown[]) => Chain
  executeTakeFirst: () => Promise<unknown>
  execute: () => Promise<unknown[]>
  set: (..._args: unknown[]) => Chain
  values: (..._args: unknown[]) => Chain
  onConflict: (..._args: unknown[]) => Chain
}
const makeChain = (): Chain => {
  const chain: Chain = {
    select: () => chain,
    where: () => chain,
    leftJoin: () => chain,
    executeTakeFirst: () => Promise.resolve(mockTenantRepoLookup()),
    execute: () => Promise.resolve([]),
    set: () => chain,
    values: () => chain,
    onConflict: () => chain,
  }
  return chain
}
const mockTenantSelectFrom = vi.fn(() => makeChain())
const mockTenantUpdateTable = vi.fn(() => makeChain())
const mockTenantInsertInto = vi.fn(() => makeChain())
vi.mock('~/app/services/tenant-db.server', () => ({
  getTenantDb: vi.fn(() => ({
    selectFrom: mockTenantSelectFrom,
    updateTable: mockTenantUpdateTable,
    insertInto: mockTenantInsertInto,
  })),
}))

const crawlTriggerMock = vi.fn()
vi.mock('~/app/services/durably.server', () => ({
  durably: {
    jobs: {
      crawl: {
        trigger: (...args: unknown[]) => crawlTriggerMock(...args),
      },
    },
  },
}))

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
    created_at text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    CONSTRAINT integrations_organization_id_fkey
      FOREIGN KEY (organization_id) REFERENCES organizations(id)
      ON UPDATE CASCADE ON DELETE CASCADE
  );
  CREATE UNIQUE INDEX integrations_organization_id_key ON integrations (organization_id);
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
    PRIMARY KEY (organization_id, installation_id),
    CONSTRAINT github_app_links_organization_id_fkey
      FOREIGN KEY (organization_id) REFERENCES organizations(id)
      ON UPDATE CASCADE ON DELETE CASCADE
  );
  CREATE UNIQUE INDEX github_app_links_installation_id_key ON github_app_links (installation_id);
  CREATE INDEX github_app_links_github_account_id_idx ON github_app_links (github_account_id);
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
rawInit.close()

vi.stubEnv('UPFLOW_DATA_DIR', path.dirname(testDbPath))

describe('processGithubWebhookPayload', () => {
  const clearSpy = vi.spyOn(cache, 'clearOrgCache')

  afterAll(async () => {
    await closeDb()
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
      })
      .execute()
    await db
      .insertInto('githubAppLinks')
      .values({
        organizationId: 'o1',
        installationId: 42,
        githubAccountId: 99,
        githubAccountType: 'Organization',
        githubOrg: 'old-login',
        appRepositorySelection: 'all',
        suspendedAt: null,
        membershipInitializedAt: '2026-04-07T00:00:00Z',
        deletedAt: null,
      })
      .execute()
    await db
      .deleteFrom('githubAppLinkEvents')
      .where('organizationId', '=', 'o1')
      .execute()
    mockTenantSelectFrom.mockClear()
    mockTenantUpdateTable.mockClear()
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

  test('installation.suspend sets suspendedAt on the link', async () => {
    await processGithubWebhookPayload('installation', {
      action: 'suspend',
      installation: { id: 42 },
    })

    const row = await db
      .selectFrom('githubAppLinks')
      .select('suspendedAt')
      .where('installationId', '=', 42)
      .executeTakeFirstOrThrow()

    expect(row.suspendedAt).not.toBeNull()
    expect(clearSpy).toHaveBeenCalledWith('o1')
  })

  test('installation.unsuspend clears suspendedAt on the link', async () => {
    await db
      .updateTable('githubAppLinks')
      .set({ suspendedAt: '2026-01-01T00:00:00Z' })
      .where('organizationId', '=', 'o1')
      .where('installationId', '=', 42)
      .execute()

    await processGithubWebhookPayload('installation', {
      action: 'unsuspend',
      installation: { id: 42 },
    })

    const row = await db
      .selectFrom('githubAppLinks')
      .select('suspendedAt')
      .where('installationId', '=', 42)
      .executeTakeFirstOrThrow()

    expect(row.suspendedAt).toBeNull()
  })

  test('installation_repositories updates selection and emits membership_synced', async () => {
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

    const events = await db
      .selectFrom('githubAppLinkEvents')
      .select(['eventType', 'source'])
      .where('organizationId', '=', 'o1')
      .where('installationId', '=', 42)
      .execute()
    expect(events).toEqual([
      {
        eventType: 'membership_synced',
        source: 'installation_repositories_webhook',
      },
    ])
  })

  test('ping event is ignored', async () => {
    await processGithubWebhookPayload('ping', { zen: 'x' })
    expect(clearSpy).not.toHaveBeenCalled()
  })
})

describe('PR webhook enqueue', () => {
  afterAll(() => {
    vi.unstubAllEnvs()
  })

  beforeEach(() => {
    vi.stubEnv('UPFLOW_DATA_DIR', path.dirname(testDbPath))
    crawlTriggerMock.mockReset()
    mockTenantRepoLookup.mockReset()
    mockTenantRepoLookup.mockResolvedValue({ id: 'tracked-repo' })
  })

  test('pull_request enqueues crawl with repository id and PR number', async () => {
    await processGithubWebhookPayload('pull_request', {
      action: 'opened',
      installation: { id: 42 },
      repository: { name: 'test-repo', owner: { login: 'test-owner' } },
      pull_request: { number: 7 },
    })

    expect(crawlTriggerMock).toHaveBeenCalledWith(
      {
        organizationId: 'o1',
        refresh: false,
        repositoryId: 'tracked-repo',
        prNumbers: [7],
      },
      expect.objectContaining({
        concurrencyKey: 'crawl:o1',
        coalesce: 'skip',
        labels: { organizationId: 'o1' },
      }),
    )
  })

  test('pull_request_review uses pull_request.number', async () => {
    await processGithubWebhookPayload('pull_request_review', {
      action: 'submitted',
      installation: { id: 42 },
      repository: { name: 'test-repo', owner: { login: 'test-owner' } },
      pull_request: { number: 12 },
    })

    expect(crawlTriggerMock).toHaveBeenCalledWith(
      expect.objectContaining({ prNumbers: [12] }),
      expect.anything(),
    )
  })

  test('pull_request_review_comment enqueues crawl', async () => {
    await processGithubWebhookPayload('pull_request_review_comment', {
      action: 'created',
      installation: { id: 42 },
      repository: { name: 'test-repo', owner: { login: 'test-owner' } },
      pull_request: { number: 3 },
    })

    expect(crawlTriggerMock).toHaveBeenCalledWith(
      expect.objectContaining({ prNumbers: [3] }),
      expect.anything(),
    )
  })

  test('unknown installation does not enqueue', async () => {
    await processGithubWebhookPayload('pull_request', {
      action: 'opened',
      installation: { id: 99999 },
      repository: { name: 'test-repo', owner: { login: 'test-owner' } },
      pull_request: { number: 1 },
    })

    expect(crawlTriggerMock).not.toHaveBeenCalled()
  })

  test('untracked repository does not enqueue', async () => {
    mockTenantRepoLookup.mockResolvedValue(undefined)

    await processGithubWebhookPayload('pull_request', {
      action: 'opened',
      installation: { id: 42 },
      repository: { name: 'other-repo', owner: { login: 'test-owner' } },
      pull_request: { number: 1 },
    })

    expect(crawlTriggerMock).not.toHaveBeenCalled()
  })
})
