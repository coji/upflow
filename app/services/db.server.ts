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
import type * as DB from './type'

const debug = createDebug('app:db')

export { sql }
export type { DB, Insertable, Selectable, Updateable }

const filename = `${process.env.NODE_ENV === 'production' ? '' : '.'}${new URL(process.env.DATABASE_URL).pathname}`
const database = new SQLite(filename, {
  verbose: (message) => {
    console.log(message)
  },
})
export const dialect = new SqliteDialect({ database })
export const db = new Kysely<DB.DB>({
  dialect,
  log: (event) => debug(event.query.sql, event.query.parameters),
  plugins: [new ParseJSONResultsPlugin(), new CamelCasePlugin()],
})
