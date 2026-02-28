/**
 * Apply tenant migrations to all tenant DBs.
 * Scans data/ directory for tenant_*.db files and applies Atlas migrations.
 * Skips tenants that already have the latest migration applied.
 */
import Database from 'better-sqlite3'
import { consola } from 'consola'
import { execFileSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'

const dataDir = './data'
const migrationsDir = './db/migrations/tenant'

function getTenantDbFiles(): string[] {
  try {
    return readdirSync(dataDir).filter(
      (f) => f.startsWith('tenant_') && f.endsWith('.db'),
    )
  } catch {
    return []
  }
}

function getLatestMigrationVersion(): string | null {
  try {
    const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'))
    if (files.length === 0) return null
    // Migration files are named like 20260226112249_initial_tenant.sql or 20260227163239.sql
    // Sort lexicographically to get the latest version
    files.sort()
    const latest = files[files.length - 1]
    // Extract version (timestamp prefix before _ or .sql)
    const match = latest.match(/^(\d+)/)
    return match ? match[1] : null
  } catch {
    return null
  }
}

function isMigrationApplied(dbPath: string, version: string): boolean {
  try {
    const db = new Database(dbPath, { readonly: true })
    try {
      const row = db
        .prepare(
          'SELECT version FROM atlas_schema_revisions WHERE version = ? LIMIT 1',
        )
        .get(version) as { version: string } | undefined
      return row !== undefined
    } finally {
      db.close()
    }
  } catch {
    // Table doesn't exist or DB is new → needs migration
    return false
  }
}

function applyMigrations(dbFile: string) {
  const url = `sqlite://${dataDir}/${dbFile}`
  consola.info(`Applying tenant migrations to ${dbFile}...`)
  execFileSync('atlas', ['migrate', 'apply', '--env', 'tenant', '--url', url], {
    stdio: 'inherit',
  })
}

const tenantDbs = getTenantDbFiles()
if (tenantDbs.length === 0) {
  consola.info('No tenant databases found. Skipping tenant migrations.')
} else {
  const latestVersion = getLatestMigrationVersion()
  if (!latestVersion) {
    consola.info('No migration files found. Skipping tenant migrations.')
  } else {
    let appliedCount = 0
    let skippedCount = 0
    for (const dbFile of tenantDbs) {
      const dbPath = join(dataDir, dbFile)
      if (isMigrationApplied(dbPath, latestVersion)) {
        skippedCount++
      } else {
        applyMigrations(dbFile)
        appliedCount++
      }
    }
    consola.info(
      `Tenant migrations: ${appliedCount} applied, ${skippedCount} skipped (already up-to-date).`,
    )
  }
}
