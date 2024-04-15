import { PrismaClient } from '@prisma/client'
import SQLite from 'better-sqlite3'
import {
  Kysely,
  SqliteDialect,
  sql,
  type Insertable,
  type Selectable,
  type Updateable,
} from 'kysely'
import type * as DB from './type'

export { sql }
export type { DB, Insertable, Selectable, Updateable }

export const db = new Kysely<DB.DB>({
  dialect: new SqliteDialect({
    database: new SQLite(new URL(process.env.DATABASE_URL).pathname),
  }),
})

export const prisma = new PrismaClient({
  log:
    process.env.NODE_ENV === 'production'
      ? []
      : [{ emit: 'event', level: 'query' }],
})

prisma.$on('query', (e) => {
  console.log(`${e.query} ${e.params}`)
})
