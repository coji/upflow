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

export const db = new Kysely<DB.DB>({
  dialect: new SqliteDialect({
    database: new SQLite(`./${new URL(process.env.DATABASE_URL).pathname}`),
  }),
  log: (event) => debug(event.query.sql, event.query.parameters),
  plugins: [new ParseJSONResultsPlugin(), new CamelCasePlugin()],
})
