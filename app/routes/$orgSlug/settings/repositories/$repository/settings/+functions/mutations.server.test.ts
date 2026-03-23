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
import type { OrganizationId } from '~/app/types/organization'
import { setupTenantSchema } from '~/test/setup-tenant-db'
import { deleteRepository } from './mutations.server'

const testDir = path.join(
  tmpdir(),
  `repo-settings-mutations-test-${Date.now()}`,
)
mkdirSync(testDir, { recursive: true })
const testDbPath = path.join(testDir, 'data.db')
writeFileSync(testDbPath, '')

vi.stubEnv('NODE_ENV', 'production')
vi.stubEnv('DATABASE_URL', `file://${testDbPath}`)

const toOrgId = (s: string) => s as OrganizationId

let testCounter = 0
function createFreshOrg(): {
  orgId: OrganizationId
  db: InstanceType<typeof SQLite>
} {
  testCounter++
  const orgId = `test-repo-settings-${Date.now()}-${testCounter}`
  const dbPath = path.join(testDir, `tenant_${orgId}.db`)
  setupTenantSchema(dbPath)
  const db = new SQLite(dbPath)
  db.exec(`
    INSERT INTO integrations (id, provider, method) VALUES ('int-1', 'github', 'token');
  `)
  return { orgId: toOrgId(orgId), db }
}

function insertRepo(db: InstanceType<typeof SQLite>, id: string, repo: string) {
  db.prepare(
    `INSERT INTO repositories (id, integration_id, provider, owner, repo, updated_at) VALUES (?, 'int-1', 'github', 'org', ?, datetime('now'))`,
  ).run(id, repo)
}

describe('repository settings mutations', () => {
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

  test('deleteRepository removes the repository', async () => {
    insertRepo(db, 'repo-1', 'my-repo')
    insertRepo(db, 'repo-2', 'other-repo')

    await deleteRepository(orgId, 'repo-1')

    const rows = db
      .prepare('SELECT id FROM repositories ORDER BY id')
      .all() as { id: string }[]
    expect(rows).toEqual([{ id: 'repo-2' }])
  })

  test('deleteRepository throws for non-existent repo', async () => {
    await expect(deleteRepository(orgId, 'non-existent')).rejects.toThrow(
      'Repository not found',
    )
  })
})
