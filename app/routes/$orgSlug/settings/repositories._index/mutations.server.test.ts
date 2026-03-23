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
import { closeTenantDb } from '~/app/services/tenant-db.server'
import { type OrganizationId, toOrgId } from '~/app/types/organization'
import { setupTenantSchema } from '~/test/setup-tenant-db'
import {
  bulkUpdateRepositoryTeam,
  updateRepositoryTeam,
} from './mutations.server'

const testDir = path.join(tmpdir(), `repo-mutations-test-${Date.now()}`)
mkdirSync(testDir, { recursive: true })
const testDbPath = path.join(testDir, 'data.db')
writeFileSync(testDbPath, '')

vi.stubEnv('NODE_ENV', 'production')
vi.stubEnv('DATABASE_URL', `file://${testDbPath}`)

let testCounter = 0
function createFreshOrg(): {
  orgId: OrganizationId
  db: InstanceType<typeof SQLite>
} {
  testCounter++
  const orgId = `test-repo-${Date.now()}-${testCounter}`
  const dbPath = path.join(testDir, `tenant_${orgId}.db`)
  setupTenantSchema(dbPath)
  const db = new SQLite(dbPath)
  db.exec(`
    INSERT INTO integrations (id, provider, method) VALUES ('int-1', 'github', 'token');
    INSERT INTO teams (id, name, display_order) VALUES ('team-a', 'Frontend', 0);
    INSERT INTO teams (id, name, display_order) VALUES ('team-b', 'Backend', 1);
  `)
  return { orgId: toOrgId(orgId), db }
}

function insertRepo(db: InstanceType<typeof SQLite>, id: string, repo: string) {
  db.prepare(
    `INSERT INTO repositories (id, integration_id, provider, owner, repo, updated_at) VALUES (?, 'int-1', 'github', 'org', ?, datetime('now'))`,
  ).run(id, repo)
}

describe('repository mutations', () => {
  let orgId: OrganizationId
  let db: InstanceType<typeof SQLite>

  afterAll(() => {
    vi.unstubAllEnvs()
  })

  beforeEach(() => {
    const fresh = createFreshOrg()
    orgId = fresh.orgId
    db = fresh.db
  })

  afterEach(async () => {
    db.close()
    await closeTenantDb(orgId)
  })

  test('updateRepositoryTeam sets team', async () => {
    insertRepo(db, 'repo-1', 'my-repo')
    await updateRepositoryTeam(orgId, 'repo-1', 'team-a')

    const row = db
      .prepare('SELECT team_id FROM repositories WHERE id = ?')
      .get('repo-1') as { team_id: string | null }
    expect(row.team_id).toBe('team-a')
  })

  test('updateRepositoryTeam clears team with null', async () => {
    insertRepo(db, 'repo-1', 'my-repo')
    db.exec("UPDATE repositories SET team_id = 'team-a' WHERE id = 'repo-1'")

    await updateRepositoryTeam(orgId, 'repo-1', null)

    const row = db
      .prepare('SELECT team_id FROM repositories WHERE id = ?')
      .get('repo-1') as { team_id: string | null }
    expect(row.team_id).toBeNull()
  })

  test('updateRepositoryTeam throws for non-existent repo', async () => {
    await expect(
      updateRepositoryTeam(orgId, 'non-existent', 'team-a'),
    ).rejects.toThrow('Repository not found')
  })

  test('bulkUpdateRepositoryTeam sets team for multiple repos', async () => {
    insertRepo(db, 'repo-1', 'repo-one')
    insertRepo(db, 'repo-2', 'repo-two')
    insertRepo(db, 'repo-3', 'repo-three')

    await bulkUpdateRepositoryTeam(orgId, ['repo-1', 'repo-2'], 'team-b')

    const rows = db
      .prepare('SELECT id, team_id FROM repositories ORDER BY id')
      .all() as { id: string; team_id: string | null }[]
    expect(rows).toEqual([
      { id: 'repo-1', team_id: 'team-b' },
      { id: 'repo-2', team_id: 'team-b' },
      { id: 'repo-3', team_id: null },
    ])
  })

  test('bulkUpdateRepositoryTeam clears team with null', async () => {
    insertRepo(db, 'repo-1', 'repo-one')
    insertRepo(db, 'repo-2', 'repo-two')
    db.exec("UPDATE repositories SET team_id = 'team-a'")

    await bulkUpdateRepositoryTeam(orgId, ['repo-1', 'repo-2'], null)

    const rows = db
      .prepare('SELECT id, team_id FROM repositories ORDER BY id')
      .all() as { id: string; team_id: string | null }[]
    expect(rows).toEqual([
      { id: 'repo-1', team_id: null },
      { id: 'repo-2', team_id: null },
    ])
  })
})
