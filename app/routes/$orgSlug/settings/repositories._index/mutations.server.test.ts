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

const testDir = path.join(tmpdir(), `repo-mutations-test-${Date.now()}`)
mkdirSync(testDir, { recursive: true })
const testDbPath = path.join(testDir, 'data.db')
writeFileSync(testDbPath, '')

vi.stubEnv('NODE_ENV', 'production')
vi.stubEnv('DATABASE_URL', `file://${testDbPath}`)

const { closeTenantDb } = await import('~/app/services/tenant-db.server')
type OrganizationId = import('~/app/types/organization').OrganizationId
const toOrgId = (s: string) => s as OrganizationId

const { updateRepositoryTeam, bulkUpdateRepositoryTeam } =
  await import('./mutations.server')

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS integrations (
    id text NOT NULL PRIMARY KEY,
    provider text NOT NULL,
    method text NOT NULL,
    private_token text NULL
  );
  CREATE TABLE IF NOT EXISTS teams (
    id text NOT NULL PRIMARY KEY,
    name text NOT NULL,
    display_order integer NOT NULL DEFAULT 0,
    created_at datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP)
  );
  CREATE TABLE IF NOT EXISTS repositories (
    id text NOT NULL PRIMARY KEY,
    integration_id text NOT NULL,
    provider text NOT NULL,
    owner text NOT NULL,
    repo text NOT NULL,
    release_detection_method text NOT NULL DEFAULT 'branch',
    release_detection_key text NOT NULL DEFAULT 'production',
    updated_at datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    created_at datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    team_id text NULL,
    FOREIGN KEY (integration_id) REFERENCES integrations (id),
    FOREIGN KEY (team_id) REFERENCES teams (id) ON DELETE SET NULL
  );
`

let testCounter = 0
function createFreshOrg(): {
  orgId: OrganizationId
  db: InstanceType<typeof SQLite>
} {
  testCounter++
  const orgId = `test-repo-${Date.now()}-${testCounter}`
  const dbPath = path.join(testDir, `tenant_${orgId}.db`)
  const db = new SQLite(dbPath)
  db.exec(SCHEMA)
  db.exec(`
    INSERT INTO integrations (id, provider, method) VALUES ('int-1', 'github', 'token');
    INSERT INTO teams (id, name, display_order) VALUES ('team-a', 'Frontend', 0);
    INSERT INTO teams (id, name, display_order) VALUES ('team-b', 'Backend', 1);
  `)
  return { orgId: toOrgId(orgId), db }
}

function insertRepo(db: InstanceType<typeof SQLite>, id: string, repo: string) {
  db.exec(
    `INSERT INTO repositories (id, integration_id, provider, owner, repo) VALUES ('${id}', 'int-1', 'github', 'org', '${repo}')`,
  )
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
