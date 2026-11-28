import { createDurably, createDurablyHandler } from '@coji/durably'
import SQLite from 'better-sqlite3'
import path from 'node:path'
import { SqliteDialect } from 'kysely'
import { createDurablyAuth } from '~/app/services/durably-auth.server'
import { resolveDataDir } from '~/db/data-dir'
import { registerDurablySentryListeners } from '~/app/libs/sentry-node.server'
import { backfillJob } from '~/app/services/jobs/backfill.server'
import { classifyJob } from '~/app/services/jobs/classify.server'
import { crawlJob } from '~/app/services/jobs/crawl.server'
import { processJob } from '~/app/services/jobs/process.server'

function createDurablyInstance() {
  // 本番 (cwd=/upflow, UPFLOW_DATA_DIR=/upflow/data) でも既定の .env (./data) でも
  // 従来の ./data/durably.db と同じ場所。別の UPFLOW_DATA_DIR で起動した instance は
  // job queue も分かれる。
  const database = new SQLite(path.join(resolveDataDir(), 'durably.db'))
  database.pragma('journal_mode = WAL')

  const dialect = new SqliteDialect({ database })

  return createDurably({
    dialect,
    retainRuns: '7d',
    leaseMs: 300_000, // 5 minutes (default 30s is too short for large orgs)
    leaseRenewIntervalMs: 30_000,
    jobs: {
      backfill: backfillJob,
      classify: classifyJob,
      crawl: crawlJob,
      process: processJob,
      recalculate: processJob, // migration alias: remove after retainRuns window (7d)
    },
  })
}

// HMR-safe singleton
declare global {
  var __durably: ReturnType<typeof createDurablyInstance> | undefined
}

if (!globalThis.__durably) {
  globalThis.__durably = createDurablyInstance()
  registerDurablySentryListeners(globalThis.__durably)
}
export const durably = globalThis.__durably

export const durablyHandler = createDurablyHandler(durably, {
  auth: createDurablyAuth(),
})

await durably.init()
