import DuckDB from 'duckdb'
import { Kysely, RawBuilder, sql } from 'kysely'
import { DuckDbDialect } from 'kysely-duckdb'
import fs from 'node:fs'
import path from 'node:path'
import type { DB } from './types'
export { sql } from 'kysely'

export const getCompanyDbPath = (companyId: string) => {
  const dbURL = new URL(process.env.DATABASE_URL)
  const dbDir = path.join(path.dirname(dbURL.pathname), 'crawler')
  fs.mkdirSync(dbDir, { recursive: true })
  return path.join(dbDir, `${companyId}.duckdb`)
}

export const crawlerDb = (companyId: string) => {
  const dbPath = getCompanyDbPath(companyId)
  return new Kysely<DB>({
    dialect: new DuckDbDialect({
      database: new DuckDB.Database(dbPath),
      tableMappings: {},
    }),
  })
}

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export const listValue = <T>(values: T[]): RawBuilder<any[]> =>
  sql`list_value(${values.length === 0 ? '' : sql.join(values)})`
