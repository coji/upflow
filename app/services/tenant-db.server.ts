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
import type { OrganizationId } from '~/app/types/organization'
import type * as TenantDB from './tenant-type'

export type { TenantDB }

export type { OrganizationId } from '~/app/types/organization'

const debug = createDebug('app:tenant-db')
const SQLITE_BUSY_TIMEOUT_MS = 5000
const SQLITE_WAL_JOURNAL_SIZE_LIMIT_BYTES = 64 * 1024 * 1024

const tenantDbCache = new Map<
  string,
  { kysely: Kysely<TenantDB.DB>; raw: SQLite.Database }
>()

function getTenantDbPath(organizationId: OrganizationId): string {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required')
  }
  const sharedDbPath = `${process.env.NODE_ENV === 'production' ? '' : '.'}${new URL(process.env.DATABASE_URL).pathname}`
  const dir = path.dirname(sharedDbPath)
  return path.join(dir, `tenant_${organizationId}.db`)
}

function ensureTenantDb(organizationId: OrganizationId) {
  const cached = tenantDbCache.get(organizationId)
  if (cached) return cached

  const filename = getTenantDbPath(organizationId)
  const database = new SQLite(filename, { fileMustExist: true })
  database.pragma('journal_mode = WAL')
  database.pragma(`busy_timeout = ${SQLITE_BUSY_TIMEOUT_MS}`)
  database.pragma('wal_autocheckpoint = 1000')
  database.pragma(`journal_size_limit = ${SQLITE_WAL_JOURNAL_SIZE_LIMIT_BYTES}`)

  const kysely = new Kysely<TenantDB.DB>({
    dialect: new SqliteDialect({ database }),
    log: (event) => debug(event.query.sql, event.query.parameters),
    plugins: [new ParseJSONResultsPlugin(), new CamelCasePlugin()],
  })

  const entry = { kysely, raw: database }
  tenantDbCache.set(organizationId, entry)
  return entry
}

export function getTenantDb(
  organizationId: OrganizationId,
): Kysely<TenantDB.DB> {
  return ensureTenantDb(organizationId).kysely
}

/**
 * Get the underlying better-sqlite3 instance for raw queries.
 * Use this to bypass ParseJSONResultsPlugin for performance-sensitive reads.
 */
export function getTenantRawDb(
  organizationId: OrganizationId,
): SQLite.Database {
  return ensureTenantDb(organizationId).raw
}

export async function closeTenantDb(
  organizationId: OrganizationId,
): Promise<void> {
  const entry = tenantDbCache.get(organizationId)
  if (entry) {
    await entry.kysely.destroy()
    entry.raw.close()
    tenantDbCache.delete(organizationId)
  }
}

export async function closeAllTenantDbs(): Promise<void> {
  await Promise.all(
    [...tenantDbCache.values()].map(async (entry) => {
      await entry.kysely.destroy()
      entry.raw.close()
    }),
  )
  tenantDbCache.clear()
}

/**
 * Create a new tenant DB file and apply migrations.
 * Call this when creating a new organization.
 */
export function createTenantDb(organizationId: OrganizationId): void {
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
export async function deleteTenantDb(
  organizationId: OrganizationId,
): Promise<void> {
  await closeTenantDb(organizationId)
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
