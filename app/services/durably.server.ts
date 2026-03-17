import { createDurably, createDurablyHandler } from '@coji/durably'
import SQLite from 'better-sqlite3'
import { SqliteDialect } from 'kysely'
import { recalculateJob } from './jobs/recalculate.server'

function createDurablyInstance() {
  const database = new SQLite('./data/durably.db')
  database.pragma('journal_mode = WAL')

  const dialect = new SqliteDialect({ database })

  return createDurably({
    dialect,
    retainRuns: '7d',
    jobs: {
      recalculate: recalculateJob,
    },
  })
}

// HMR-safe singleton
declare global {
  var __durably: ReturnType<typeof createDurablyInstance> | undefined
}

if (!globalThis.__durably) {
  globalThis.__durably = createDurablyInstance()
}
export const durably = globalThis.__durably

export const durablyHandler = createDurablyHandler(durably)

await durably.init()
