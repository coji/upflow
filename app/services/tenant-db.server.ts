import SQLite from 'better-sqlite3'
import createDebug from 'debug'
import {
  CamelCasePlugin,
  Kysely,
  ParseJSONResultsPlugin,
  SqliteDialect,
} from 'kysely'
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
  const database = new SQLite(filename)
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

export { getTenantDbPath }
