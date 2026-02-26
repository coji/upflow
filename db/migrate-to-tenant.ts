/**
 * Data migration script: single DB → shared + tenant DBs
 *
 * Copies tenant-scoped data from the original data.db to per-organization
 * tenant_<orgId>.db files. The shared DB retains only shared tables.
 *
 * Usage:
 *   pnpm tsx db/migrate-to-tenant.ts
 *
 * Prerequisites:
 *   - Original data.db must exist at DATABASE_URL
 *   - Tenant migrations must be available (db/migrations/tenant/)
 */
import SQLite from 'better-sqlite3'
import { consola } from 'consola'
import 'dotenv/config'
import { copyFileSync, existsSync } from 'node:fs'
import {
  createTenantDb,
  getTenantDbPath,
} from '~/app/services/tenant-db.server'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required')
}

const sharedDbPath = `${process.env.NODE_ENV === 'production' ? '' : '.'}${new URL(process.env.DATABASE_URL).pathname}`

// 1. Backup
const backupPath = `${sharedDbPath}.backup`
if (!existsSync(backupPath)) {
  consola.info(`Backing up ${sharedDbPath} → ${backupPath}`)
  copyFileSync(sharedDbPath, backupPath)
} else {
  consola.warn(`Backup already exists at ${backupPath}, skipping backup.`)
}

const sourceDb = new SQLite(sharedDbPath)
sourceDb.pragma('journal_mode = WAL')

// 2. Get all organizations
const organizations = sourceDb
  .prepare('SELECT id, name FROM organizations')
  .all() as { id: string; name: string }[]

consola.info(`Found ${organizations.length} organization(s).`)

// Tenant tables to migrate (in dependency order)
const tenantTables = [
  'organization_settings',
  'export_settings',
  'integrations',
  'repositories',
  'pull_requests',
  'pull_request_reviews',
  'pull_request_reviewers',
  'company_github_users',
] as const

// Tables that reference organization_id directly
const tablesWithOrgId = [
  'organization_settings',
  'export_settings',
  'integrations',
  'repositories',
  'company_github_users',
] as const

// Tables that are linked via repository_id (indirect org relationship)
const tablesViaRepo = [
  'pull_requests',
  'pull_request_reviews',
  'pull_request_reviewers',
] as const

// 3. Migrate each organization
for (const org of organizations) {
  consola.info(`\nMigrating org: ${org.name} (${org.id})`)

  const tenantDbPath = getTenantDbPath(org.id)
  if (existsSync(tenantDbPath)) {
    consola.warn(`  Tenant DB already exists at ${tenantDbPath}, skipping.`)
    continue
  }

  // Create tenant DB with schema
  createTenantDb(org.id)
  const tenantDb = new SQLite(tenantDbPath)
  tenantDb.pragma('journal_mode = WAL')

  // Get column info for each tenant table (to exclude organization_id)
  for (const table of tablesWithOrgId) {
    const rows = sourceDb
      .prepare(`SELECT * FROM ${table} WHERE organization_id = ?`)
      .all(org.id) as Record<string, unknown>[]

    if (rows.length === 0) {
      consola.info(`  ${table}: 0 rows`)
      continue
    }

    // Get tenant table columns (without organization_id)
    const tenantColumns = tenantDb
      .prepare(`PRAGMA table_info(${table})`)
      .all() as { name: string }[]
    const columnNames = tenantColumns.map((c) => c.name)

    // Insert rows, mapping columns
    const placeholders = columnNames.map(() => '?').join(', ')
    const insertStmt = tenantDb.prepare(
      `INSERT OR IGNORE INTO ${table} (${columnNames.join(', ')}) VALUES (${placeholders})`,
    )

    const insertMany = tenantDb.transaction(
      (data: Record<string, unknown>[]) => {
        for (const row of data) {
          const values = columnNames.map((col) => row[col] ?? null)
          insertStmt.run(...values)
        }
      },
    )

    insertMany(rows)
    consola.info(`  ${table}: ${rows.length} rows`)
  }

  // Migrate tables linked via repository_id
  const repoIds = sourceDb
    .prepare('SELECT id FROM repositories WHERE organization_id = ?')
    .all(org.id) as { id: string }[]

  if (repoIds.length > 0) {
    const repoIdList = repoIds.map((r) => r.id)
    const repoPlaceholders = repoIdList.map(() => '?').join(', ')

    for (const table of tablesViaRepo) {
      const rows = sourceDb
        .prepare(
          `SELECT * FROM ${table} WHERE repository_id IN (${repoPlaceholders})`,
        )
        .all(...repoIdList) as Record<string, unknown>[]

      if (rows.length === 0) {
        consola.info(`  ${table}: 0 rows`)
        continue
      }

      const tenantColumns = tenantDb
        .prepare(`PRAGMA table_info(${table})`)
        .all() as { name: string }[]
      const columnNames = tenantColumns.map((c) => c.name)

      const placeholders = columnNames.map(() => '?').join(', ')
      const insertStmt = tenantDb.prepare(
        `INSERT OR IGNORE INTO ${table} (${columnNames.join(', ')}) VALUES (${placeholders})`,
      )

      const insertMany = tenantDb.transaction(
        (data: Record<string, unknown>[]) => {
          for (const row of data) {
            const values = columnNames.map((col) => row[col] ?? null)
            insertStmt.run(...values)
          }
        },
      )

      insertMany(rows)
      consola.info(`  ${table}: ${rows.length} rows`)
    }
  }

  tenantDb.close()
}

// 4. Verify row counts
consola.info('\n--- Verification ---')
let allMatch = true

for (const table of tenantTables) {
  const isDirectOrgTable = (tablesWithOrgId as readonly string[]).includes(
    table,
  )
  const sourceCount = isDirectOrgTable
    ? (
        sourceDb.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as {
          count: number
        }
      ).count
    : (
        sourceDb.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as {
          count: number
        }
      ).count

  let tenantTotal = 0
  for (const org of organizations) {
    const tenantDbPath = getTenantDbPath(org.id)
    if (!existsSync(tenantDbPath)) continue
    const tenantDb = new SQLite(tenantDbPath, { readonly: true })
    const result = tenantDb
      .prepare(`SELECT COUNT(*) as count FROM ${table}`)
      .get() as { count: number }
    tenantTotal += result.count
    tenantDb.close()
  }

  const match = sourceCount === tenantTotal
  if (!match) allMatch = false
  const icon = match ? '✓' : '✗'
  consola.info(
    `  ${icon} ${table}: source=${sourceCount}, tenant_total=${tenantTotal}`,
  )
}

if (allMatch) {
  consola.success('\nAll row counts match. Migration verified.')
} else {
  consola.error(
    '\nRow count mismatch detected! Aborting before dropping tables.',
  )
  consola.error('Restore from backup and investigate the issue.')
  sourceDb.close()
  process.exit(1)
}

// 5. Drop tenant tables from shared DB
consola.info('\n--- Cleaning shared DB ---')
const dropOrder = [
  'pull_request_reviewers',
  'pull_request_reviews',
  'pull_requests',
  'repositories',
  'company_github_users',
  'integrations',
  'export_settings',
  'organization_settings',
] as const

for (const table of dropOrder) {
  try {
    sourceDb.exec(`DROP TABLE IF EXISTS ${table}`)
    consola.info(`  Dropped ${table}`)
  } catch (e) {
    consola.error(`  Failed to drop ${table}:`, e)
  }
}

// Clean up orphaned indexes
sourceDb.exec('VACUUM')

sourceDb.close()
consola.success('Migration complete!')
