import SQLite from 'better-sqlite3'
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, test, vi } from 'vitest'
import { closeAllTenantDbs } from '~/app/services/tenant-db.server'
import { toOrgId } from '~/app/types/organization'
import { DEFAULT_TIMEZONE } from './constants'
import { getOrganizationTimezone } from './timezone.server'

const testDir = path.join(tmpdir(), `timezone-test-${Date.now()}`)
mkdirSync(testDir, { recursive: true })
const testDbPath = path.join(testDir, 'data.db')
writeFileSync(testDbPath, '')

vi.stubEnv('UPFLOW_DATA_DIR', path.dirname(testDbPath))

function createTenantWithSettings(orgId: string, timezone?: string) {
  const dbPath = path.join(testDir, `tenant_${orgId}.db`)
  const db = new SQLite(dbPath)
  db.exec(`
    CREATE TABLE IF NOT EXISTS organization_settings (
      id TEXT PRIMARY KEY,
      timezone TEXT NOT NULL DEFAULT 'Asia/Tokyo',
      updated_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    )
  `)
  if (timezone !== undefined) {
    db.exec(
      `INSERT INTO organization_settings (id, timezone, updated_at) VALUES ('s1', '${timezone}', datetime('now'))`,
    )
  }
  db.close()
}

function createTenantEmpty(orgId: string) {
  const dbPath = path.join(testDir, `tenant_${orgId}.db`)
  const db = new SQLite(dbPath)
  db.exec(`
    CREATE TABLE IF NOT EXISTS organization_settings (
      id TEXT PRIMARY KEY,
      timezone TEXT NOT NULL DEFAULT 'Asia/Tokyo',
      updated_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    )
  `)
  db.close()
}

afterAll(async () => {
  await closeAllTenantDbs()
})

describe('getOrganizationTimezone', () => {
  test('returns configured timezone', async () => {
    const orgId = toOrgId(`tz-configured-${Date.now()}`)
    createTenantWithSettings(orgId, 'America/New_York')
    const tz = await getOrganizationTimezone(orgId)
    expect(tz).toBe('America/New_York')
  })

  test('returns DEFAULT_TIMEZONE when no settings row exists', async () => {
    const orgId = toOrgId(`tz-no-row-${Date.now()}`)
    createTenantEmpty(orgId)
    const tz = await getOrganizationTimezone(orgId)
    expect(tz).toBe(DEFAULT_TIMEZONE)
  })

  test('returns Asia/Tokyo when timezone is set to default', async () => {
    const orgId = toOrgId(`tz-default-${Date.now()}`)
    createTenantWithSettings(orgId, 'Asia/Tokyo')
    const tz = await getOrganizationTimezone(orgId)
    expect(tz).toBe('Asia/Tokyo')
  })
})
