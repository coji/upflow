import SQLite from 'better-sqlite3'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

// Set up a temp directory to act as the data dir
const testDir = path.join(tmpdir(), `tenant-db-test-${Date.now()}`)
mkdirSync(testDir, { recursive: true })
const testDbPath = path.join(testDir, 'data.db')
writeFileSync(testDbPath, '') // create empty shared DB file

// getTenantDbPath uses: `${NODE_ENV === 'production' ? '' : '.'}${new URL(DATABASE_URL).pathname}`
// In production mode, pathname is used as-is. Use production mode for predictable paths.
vi.stubEnv('NODE_ENV', 'production')
vi.stubEnv('DATABASE_URL', `file://${testDbPath}`)

const { closeTenantDb, closeAllTenantDbs, deleteTenantDb, getTenantDb } =
  await import('./tenant-db.server')

function createTestTenantDb(orgId: string): string {
  const dbPath = path.join(testDir, `tenant_${orgId}.db`)
  const db = new SQLite(dbPath)
  db.exec('CREATE TABLE IF NOT EXISTS test_table (id TEXT PRIMARY KEY)')
  db.close()
  return dbPath
}

describe('getTenantDb', () => {
  const orgId = `test-org-get-${Date.now()}`

  beforeEach(() => {
    createTestTenantDb(orgId)
  })

  afterEach(() => {
    closeTenantDb(orgId)
  })

  test('returns a Kysely instance for an existing tenant DB', () => {
    const tenantDb = getTenantDb(orgId)
    expect(tenantDb).toBeDefined()
  })

  test('returns the same cached instance on subsequent calls', () => {
    const db1 = getTenantDb(orgId)
    const db2 = getTenantDb(orgId)
    expect(db1).toBe(db2)
  })

  test('throws when tenant DB file does not exist', () => {
    expect(() => getTenantDb('nonexistent-org')).toThrow()
  })
})

describe('closeTenantDb', () => {
  const orgId = `test-org-close-${Date.now()}`

  beforeEach(() => {
    createTestTenantDb(orgId)
  })

  test('removes the cached instance', () => {
    const db1 = getTenantDb(orgId)
    closeTenantDb(orgId)
    const db2 = getTenantDb(orgId)
    expect(db2).not.toBe(db1)
  })

  test('does not throw for unknown orgId', () => {
    expect(() => closeTenantDb('unknown-org')).not.toThrow()
  })
})

describe('closeAllTenantDbs', () => {
  const orgId1 = `test-org-all-1-${Date.now()}`
  const orgId2 = `test-org-all-2-${Date.now()}`

  beforeEach(() => {
    createTestTenantDb(orgId1)
    createTestTenantDb(orgId2)
  })

  afterEach(() => {
    closeTenantDb(orgId1)
    closeTenantDb(orgId2)
  })

  test('clears all cached instances', () => {
    const db1 = getTenantDb(orgId1)
    const db2 = getTenantDb(orgId2)
    closeAllTenantDbs()
    const db1New = getTenantDb(orgId1)
    const db2New = getTenantDb(orgId2)
    expect(db1New).not.toBe(db1)
    expect(db2New).not.toBe(db2)
  })
})

describe('deleteTenantDb', () => {
  const orgId = `test-org-delete-${Date.now()}`

  test('deletes the DB file and WAL/SHM files', () => {
    const dbPath = createTestTenantDb(orgId)
    // Create WAL and SHM files
    writeFileSync(`${dbPath}-wal`, '')
    writeFileSync(`${dbPath}-shm`, '')

    // Open a connection first so it gets cached
    getTenantDb(orgId)

    deleteTenantDb(orgId)

    expect(existsSync(dbPath)).toBe(false)
    expect(existsSync(`${dbPath}-wal`)).toBe(false)
    expect(existsSync(`${dbPath}-shm`)).toBe(false)
  })

  test('does not throw when DB file does not exist', () => {
    expect(() => deleteTenantDb('nonexistent-delete-org')).not.toThrow()
  })
})
