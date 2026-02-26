import SQLite from 'better-sqlite3'
import createDebug from 'debug'
import {
  CamelCasePlugin,
  Kysely,
  ParseJSONResultsPlugin,
  SqliteDialect,
} from 'kysely'
import { execFileSync } from 'node:child_process'
import { existsSync, unlinkSync } from 'node:fs'
import path from 'node:path'
import type * as TenantDB from './tenant-type'

export type { TenantDB }

const debug = createDebug('app:tenant-db')

const tenantDbCache = new Map<string, Kysely<TenantDB.DB>>()

function getTenantDbPath(organizationId: string): string {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required')
  }
  const sharedDbPath = `${process.env.NODE_ENV === 'production' ? '' : '.'}${new URL(process.env.DATABASE_URL).pathname}`
  const dir = path.dirname(sharedDbPath)
  return path.join(dir, `tenant_${organizationId}.db`)
}

export function getTenantDb(organizationId: string): Kysely<TenantDB.DB> {
  const cached = tenantDbCache.get(organizationId)
  if (cached) return cached

  const filename = getTenantDbPath(organizationId)
  const database = new SQLite(filename, { fileMustExist: true })
  database.pragma('journal_mode = WAL')

  const tenantDb = new Kysely<TenantDB.DB>({
    dialect: new SqliteDialect({ database }),
    log: (event) => debug(event.query.sql, event.query.parameters),
    plugins: [new ParseJSONResultsPlugin(), new CamelCasePlugin()],
  })

  tenantDbCache.set(organizationId, tenantDb)
  return tenantDb
}

export function closeTenantDb(organizationId: string): void {
  const tenantDb = tenantDbCache.get(organizationId)
  if (tenantDb) {
    tenantDb.destroy()
    tenantDbCache.delete(organizationId)
  }
}

export function closeAllTenantDbs(): void {
  for (const [, tenantDb] of tenantDbCache) {
    tenantDb.destroy()
  }
  tenantDbCache.clear()
}

/**
 * Create a new tenant DB file and apply migrations.
 * Call this when creating a new organization.
 */
export function createTenantDb(organizationId: string): void {
  const tenantDbPath = getTenantDbPath(organizationId)
  execFileSync(
    'atlas',
    [
      'migrate',
      'apply',
      '--env',
      'tenant',
      '--url',
      `sqlite://${tenantDbPath}`,
    ],
    { stdio: 'inherit' },
  )
}

/**
 * Delete the tenant DB file.
 * Call closeTenantDb first to release the connection.
 */
export function deleteTenantDb(organizationId: string): void {
  closeTenantDb(organizationId)
  const tenantDbPath = getTenantDbPath(organizationId)
  if (existsSync(tenantDbPath)) {
    unlinkSync(tenantDbPath)
  }
  // Also clean up WAL and SHM files
  for (const suffix of ['-wal', '-shm']) {
    const walPath = tenantDbPath + suffix
    if (existsSync(walPath)) {
      unlinkSync(walPath)
    }
  }
}

export { getTenantDbPath }
