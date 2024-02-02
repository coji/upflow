import path from 'node:path'
import DuckDB from 'duckdb'
import { Kysely } from 'kysely'
import { DuckDbDialect } from 'kysely-duckdb'
import type { DB } from './types'

const dbURL = new URL(process.env.DATABASE_URL)
const dbPath = `${path.dirname(dbURL.pathname)}/crawler.duckdb`

export const crawlerDb = new Kysely<DB>({
  dialect: new DuckDbDialect({
    database: new DuckDB.Database(dbPath),
    tableMappings: {},
  }),
})
