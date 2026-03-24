import SQLite from 'better-sqlite3'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  closeAllTenantDbs,
  closeTenantDb,
  deleteTenantDb,
  getTenantDb,
} from '~/app/services/tenant-db.server'
import { toOrgId } from '~/app/types/organization'

// Set up a temp directory to act as the data dir
const testDir = path.join(tmpdir(), `tenant-db-test-${Date.now()}`)
mkdirSync(testDir, { recursive: true })
const testDbPath = path.join(testDir, 'data.db')
writeFileSync(testDbPath, '') // create empty shared DB file

// getTenantDbPath uses: path.join(resolveDataDir(), `tenant_${orgId}.db`)
vi.stubEnv('UPFLOW_DATA_DIR', path.dirname(testDbPath))

function createTestTenantDb(orgId: string): string {
  const dbPath = path.join(testDir, `tenant_${orgId}.db`)
  const db = new SQLite(dbPath)
  db.exec('CREATE TABLE IF NOT EXISTS test_table (id TEXT PRIMARY KEY)')
  db.close()
  return dbPath
}

describe('getTenantDb', () => {
  const orgId = toOrgId(`test-org-get-${Date.now()}`)

  beforeEach(() => {
    createTestTenantDb(orgId)
  })

  afterEach(async () => {
    await closeTenantDb(orgId)
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
    expect(() => getTenantDb(toOrgId('nonexistent-org'))).toThrow()
  })
})

describe('closeTenantDb', () => {
  const orgId = toOrgId(`test-org-close-${Date.now()}`)

  beforeEach(() => {
    createTestTenantDb(orgId)
  })

  test('removes the cached instance', async () => {
    const db1 = getTenantDb(orgId)
    await closeTenantDb(orgId)
    const db2 = getTenantDb(orgId)
    expect(db2).not.toBe(db1)
  })

  test('does not throw for unknown orgId', async () => {
    await expect(closeTenantDb(toOrgId('unknown-org'))).resolves.not.toThrow()
  })
})

describe('closeAllTenantDbs', () => {
  const orgId1 = toOrgId(`test-org-all-1-${Date.now()}`)
  const orgId2 = toOrgId(`test-org-all-2-${Date.now()}`)

  beforeEach(() => {
    createTestTenantDb(orgId1)
    createTestTenantDb(orgId2)
  })

  afterEach(async () => {
    await closeTenantDb(orgId1)
    await closeTenantDb(orgId2)
  })

  test('clears all cached instances', async () => {
    const db1 = getTenantDb(orgId1)
    const db2 = getTenantDb(orgId2)
    await closeAllTenantDbs()
    const db1New = getTenantDb(orgId1)
    const db2New = getTenantDb(orgId2)
    expect(db1New).not.toBe(db1)
    expect(db2New).not.toBe(db2)
  })
})

describe('deleteTenantDb', () => {
  const orgId = toOrgId(`test-org-delete-${Date.now()}`)

  test('deletes the DB file and WAL/SHM files', async () => {
    const dbPath = createTestTenantDb(orgId)
    // Create WAL and SHM files
    writeFileSync(`${dbPath}-wal`, '')
    writeFileSync(`${dbPath}-shm`, '')

    // Open a connection first so it gets cached
    getTenantDb(orgId)

    await deleteTenantDb(orgId)

    expect(existsSync(dbPath)).toBe(false)
    expect(existsSync(`${dbPath}-wal`)).toBe(false)
    expect(existsSync(`${dbPath}-shm`)).toBe(false)
  })

  test('does not throw when DB file does not exist', async () => {
    await expect(
      deleteTenantDb(toOrgId('nonexistent-delete-org')),
    ).resolves.not.toThrow()
  })
})
