import SQLite from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
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

const testDir = path.join(tmpdir(), `github-users-mutations-test-${Date.now()}`)
mkdirSync(testDir, { recursive: true })
const sharedDbPath = path.join(testDir, 'data.db')

// Create shared DB with users + sessions tables
const sharedDb = new SQLite(sharedDbPath)
sharedDb.exec(`
  CREATE TABLE users (
    id text NOT NULL PRIMARY KEY,
    name text NOT NULL,
    email text NOT NULL,
    email_verified boolean NOT NULL DEFAULT 0,
    role text NOT NULL DEFAULT 'user',
    created_at datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    updated_at datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP)
  );
  CREATE TABLE sessions (
    id text NOT NULL PRIMARY KEY,
    expires_at datetime NOT NULL,
    token text NOT NULL,
    created_at datetime NOT NULL,
    updated_at datetime NOT NULL,
    user_id text NOT NULL,
    CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id)
  );
`)
sharedDb.close()

vi.stubEnv('NODE_ENV', 'production')
vi.stubEnv('DATABASE_URL', `file://${sharedDbPath}`)

const { closeTenantDb } = await import('~/app/services/tenant-db.server')
type OrganizationId = import('~/app/services/tenant-db.server').OrganizationId
const toOrgId = (s: string) => s as OrganizationId

const { deleteGithubUser, toggleGithubUserActive } =
  await import('./mutations.server')

const TENANT_SCHEMA = `
  CREATE TABLE IF NOT EXISTS company_github_users (
    user_id text NULL,
    login text NOT NULL PRIMARY KEY,
    display_name text NOT NULL,
    is_active integer NOT NULL DEFAULT 0,
    updated_at datetime NOT NULL,
    created_at datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP)
  );
`

let testCounter = 0
function createFreshOrg(): OrganizationId {
  testCounter++
  const orgId = `test-gh-users-${Date.now()}-${testCounter}`
  const dbPath = path.join(testDir, `tenant_${orgId}.db`)
  const tenantDb = new SQLite(dbPath)
  tenantDb.exec(TENANT_SCHEMA)
  tenantDb.close()
  return toOrgId(orgId)
}

function seedUser(userId: string) {
  const raw = new SQLite(sharedDbPath)
  raw.exec(`
    INSERT OR IGNORE INTO users (id, name, email, email_verified, role, updated_at)
    VALUES ('${userId}', 'Test User', 'test@example.com', 0, 'user', datetime('now'))
  `)
  raw.close()
}

function seedSession(sessionId: string, userId: string) {
  const raw = new SQLite(sharedDbPath)
  raw.exec(`
    INSERT INTO sessions (id, expires_at, token, created_at, updated_at, user_id)
    VALUES ('${sessionId}', datetime('now', '+1 day'), '${sessionId}-token', datetime('now'), datetime('now'), '${userId}')
  `)
  raw.close()
}

function seedTenantGithubUser(
  orgId: OrganizationId,
  login: string,
  userId: string | null,
) {
  const dbPath = path.join(testDir, `tenant_${orgId}.db`)
  const raw = new SQLite(dbPath)
  raw.exec(`
    INSERT INTO company_github_users (login, display_name, is_active, updated_at${userId ? ', user_id' : ''})
    VALUES ('${login}', '${login}', 1, datetime('now')${userId ? `, '${userId}'` : ''})
  `)
  raw.close()
}

function countSessions(userId: string): number {
  const raw = new SQLite(sharedDbPath)
  const row = raw
    .prepare('SELECT count(*) as cnt FROM sessions WHERE user_id = ?')
    .get(userId) as { cnt: number }
  raw.close()
  return row.cnt
}

function cleanSharedDb() {
  const raw = new SQLite(sharedDbPath)
  raw.exec('DELETE FROM sessions')
  raw.exec('DELETE FROM users')
  raw.close()
}

afterAll(() => {
  vi.unstubAllEnvs()
})

describe('toggleGithubUserActive session invalidation', () => {
  let orgId: OrganizationId

  beforeEach(() => {
    cleanSharedDb()
    orgId = createFreshOrg()
  })

  afterEach(async () => {
    await closeTenantDb(orgId)
  })

  test('isActive=0 deletes all sessions for the user', async () => {
    const userId = 'user-deactivate-1'
    seedUser(userId)
    seedSession('sess-1', userId)
    seedSession('sess-2', userId)
    seedTenantGithubUser(orgId, 'octocat', userId)

    expect(countSessions(userId)).toBe(2)

    await toggleGithubUserActive({
      login: 'octocat',
      isActive: 0,
      organizationId: orgId,
      currentUserId: 'other-user',
    })

    expect(countSessions(userId)).toBe(0)
  })

  test('isActive=1 does not delete sessions', async () => {
    const userId = 'user-activate-1'
    seedUser(userId)
    seedSession('sess-3', userId)
    seedTenantGithubUser(orgId, 'octocat2', userId)

    await toggleGithubUserActive({
      login: 'octocat2',
      isActive: 1,
      organizationId: orgId,
      currentUserId: 'other-user',
    })

    expect(countSessions(userId)).toBe(1)
  })

  test('isActive=0 with null userId does not error', async () => {
    seedTenantGithubUser(orgId, 'new-user', null)

    await expect(
      toggleGithubUserActive({
        login: 'new-user',
        isActive: 0,
        organizationId: orgId,
        currentUserId: 'other-user',
      }),
    ).resolves.not.toThrow()
  })

  test('isActive=0 throws when deactivating yourself', async () => {
    const userId = 'user-self-deactivate'
    seedUser(userId)
    seedTenantGithubUser(orgId, 'self-user', userId)

    await expect(
      toggleGithubUserActive({
        login: 'self-user',
        isActive: 0,
        organizationId: orgId,
        currentUserId: userId,
      }),
    ).rejects.toThrow('Cannot deactivate yourself')
  })
})

describe('deleteGithubUser session invalidation', () => {
  let orgId: OrganizationId

  beforeEach(() => {
    cleanSharedDb()
    orgId = createFreshOrg()
  })

  afterEach(async () => {
    await closeTenantDb(orgId)
  })

  test('deletes all sessions for the user', async () => {
    const userId = 'user-delete-1'
    seedUser(userId)
    seedSession('sess-del-1', userId)
    seedSession('sess-del-2', userId)
    seedTenantGithubUser(orgId, 'octocat-del', userId)

    expect(countSessions(userId)).toBe(2)

    await deleteGithubUser('octocat-del', orgId, 'other-user')

    expect(countSessions(userId)).toBe(0)
  })

  test('with null userId does not error', async () => {
    seedTenantGithubUser(orgId, 'no-user-del', null)

    await expect(
      deleteGithubUser('no-user-del', orgId, 'other-user'),
    ).resolves.not.toThrow()
  })

  test('throws when deleting yourself', async () => {
    const userId = 'user-self-delete'
    seedUser(userId)
    seedTenantGithubUser(orgId, 'self-del', userId)

    await expect(deleteGithubUser('self-del', orgId, userId)).rejects.toThrow(
      'Cannot delete yourself',
    )
  })
})
