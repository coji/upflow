import { createDurably, createDurablyHandler } from '@coji/durably'
import SQLite from 'better-sqlite3'
import { SqliteDialect } from 'kysely'
import { getSession, getUserOrganizations } from '~/app/libs/auth.server'
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
      // If a specific org is requested via label, verify access
      const requestedOrgId = filter.labels?.organizationId
      if (requestedOrgId) {
        if (!ctx.orgIds.has(requestedOrgId)) {
          throw new Response('Forbidden', { status: 403 })
        }
        return filter
      }
      // Otherwise, only show runs from user's orgs (pick first org for simplicity)
      const firstOrgId = ctx.orgIds.values().next().value
      if (!firstOrgId) {
        throw new Response('Forbidden', { status: 403 })
      }
      return {
        ...filter,
        labels: { ...filter.labels, organizationId: firstOrgId },
      }
    },
  },
})

await durably.init()
