import { PrismaClient } from '@prisma/client'
import SQLite from 'better-sqlite3'
import createDebug from 'debug'
import {
  Kysely,
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
    database: new SQLite(new URL(process.env.DATABASE_URL).pathname),
  }),
  log: (event) => debug(event.query.sql, event.query.parameters),
})

export const prisma = new PrismaClient({
  log:
    process.env.NODE_ENV === 'production'
      ? []
      : [{ emit: 'event', level: 'query' }],
})

prisma.$on('query', (e) => {
  debug(`${e.query} ${e.params}`)
})
