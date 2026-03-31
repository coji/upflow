import { createDurably, createDurablyHandler } from '@coji/durably'
import SQLite from 'better-sqlite3'
import { SqliteDialect } from 'kysely'
import { getSession, getUserOrganizations } from '~/app/libs/auth.server'
import { registerDurablySentryListeners } from '~/app/libs/sentry-node.server'
import { backfillJob } from '~/app/services/jobs/backfill.server'
import { classifyJob } from '~/app/services/jobs/classify.server'
import { crawlJob } from '~/app/services/jobs/crawl.server'
import { processJob } from '~/app/services/jobs/process.server'

function createDurablyInstance() {
  const database = new SQLite('./data/durably.db')
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
  auth: {
    authenticate: async (request) => {
      const session = await getSession(request)
      if (!session) {
        throw new Response('Unauthorized', { status: 401 })
      }
      const orgs = await getUserOrganizations(session.user.id)
      return {
        userId: session.user.id,
        orgIds: new Set(orgs.map((o) => o.id)),
      }
    },

    // Block HTTP trigger — jobs are triggered server-side via route actions only
    onTrigger: () => {
      throw new Response('Forbidden', { status: 403 })
    },

    // Verify user has access to the run's organization
    onRunAccess: (ctx, run) => {
      const orgId = run.labels?.organizationId
      if (!orgId || !ctx.orgIds.has(orgId)) {
        throw new Response('Forbidden', { status: 403 })
      }
    },

    // Scope run queries to user's organizations
    scopeRuns: (ctx, filter) => {
      const requestedOrgId = filter.labels?.organizationId
      if (!requestedOrgId) {
        throw new Response('Bad Request: organizationId label is required', {
          status: 400,
        })
      }
      if (!ctx.orgIds.has(requestedOrgId)) {
        throw new Response('Forbidden', { status: 403 })
      }
      return filter
    },
  },
})

await durably.init()
