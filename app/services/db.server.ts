import SQLite from 'better-sqlite3'
import createDebug from 'debug'
import {
  CamelCasePlugin,
  Kysely,
  ParseJSONResultsPlugin,
  SqliteDialect,
  sql,
  type Insertable,
  type Selectable,
  type Updateable,
} from 'kysely'
import path from 'node:path'
import { resolveDataDir } from '~/db/data-dir'
import type * as DB from './type'

export { resolveDataDir }

const debug = createDebug('app:db')
const SQLITE_BUSY_TIMEOUT_MS = 5000

export { sql }
export type { DB, Insertable, Selectable, Updateable }

type SharedDbState = {
  database: SQLite.Database
  dialect: SqliteDialect
  kysely: Kysely<DB.DB>
}

let sharedDbState: SharedDbState | undefined

function getSharedDbState(): SharedDbState {
  if (sharedDbState) return sharedDbState

  const filename = path.join(resolveDataDir(), 'data.db')
  const database = new SQLite(filename)
  database.pragma('journal_mode = WAL')
  database.pragma(`busy_timeout = ${SQLITE_BUSY_TIMEOUT_MS}`)
  database.pragma('wal_autocheckpoint = 1000')
  const dialect = new SqliteDialect({ database })
  const kysely = new Kysely<DB.DB>({
    dialect,
    log: (event) => debug(event.query.sql, event.query.parameters),
    plugins: [new ParseJSONResultsPlugin(), new CamelCasePlugin()],
  })
  sharedDbState = { database, dialect, kysely }
  return sharedDbState
}

function createLazyProxy<T extends object>(getTarget: () => T): T {
  return new Proxy({} as T, {
    get(_target, prop, receiver) {
      const target = getTarget()
      const value = Reflect.get(target, prop, receiver)
      return typeof value === 'function'
        ? (value as (...args: unknown[]) => unknown).bind(target)
        : value
    },
  })
}

export const dialect = createLazyProxy<SqliteDialect>(
  () => getSharedDbState().dialect,
)
export const db = createLazyProxy<Kysely<DB.DB>>(
  () => getSharedDbState().kysely,
)

export async function closeDb(): Promise<void> {
  if (!sharedDbState) return
  await sharedDbState.kysely.destroy()
  sharedDbState = undefined
}
