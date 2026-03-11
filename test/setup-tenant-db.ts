import SQLite from 'better-sqlite3'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const tenantSchema = readFileSync(
  path.resolve(import.meta.dirname, '../db/tenant.sql'),
  'utf-8',
)

/**
 * Create a tenant DB file from the canonical tenant.sql schema.
 * Keeps test schemas in sync with the real schema automatically.
 */
export function setupTenantSchema(dbPath: string): void {
  const db = new SQLite(dbPath)
  try {
    db.exec(tenantSchema)
  } finally {
    db.close()
  }
}
