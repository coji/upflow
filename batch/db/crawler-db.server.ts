import path from 'node:path'
import DuckDB from 'duckdb'
import { Kysely, RawBuilder, sql } from 'kysely'
import { DuckDbDialect } from 'kysely-duckdb'
import type { DB } from './types'
export { sql } from 'kysely'

const dbURL = new URL(process.env.DATABASE_URL)
const dbPath = `${path.dirname(dbURL.pathname)}/crawler.duckdb`

export const crawlerDb = new Kysely<DB>({
  dialect: new DuckDbDialect({
    database: new DuckDB.Database(dbPath),
    tableMappings: {},
  }),
})

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export const listValue = <T>(values: T[]): RawBuilder<any[]> =>
  sql`list_value(${values.length === 0 ? '' : sql.join(values)})`
