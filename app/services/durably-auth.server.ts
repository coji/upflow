import type { AuthConfig } from '@coji/durably'
import { getSession, getUserOrganizations } from '~/app/libs/auth.server'
import { isOrgAdmin } from '~/app/libs/member-role'

interface DurablyAuthContext {
  userId: string
  /** Organizations where the user is an owner or admin */
  orgIds: Set<string>
}

interface DurablyAuthDeps {
  getSession: (
    request: Request,
  ) => Promise<{ user: { id: string } } | null | undefined>
  getUserOrganizations: typeof getUserOrganizations
}

export const createDurablyAuth = (
  deps: DurablyAuthDeps = { getSession, getUserOrganizations },
): AuthConfig<DurablyAuthContext> => ({
  authenticate: async (request) => {
    const session = await deps.getSession(request)
    if (!session) {
      throw new Response('Unauthorized', { status: 401 })
    }
    const orgs = await deps.getUserOrganizations(session.user.id)
    // Job runs are an admin feature (settings > data management). Members
    // must not read, cancel, retrigger, or delete runs, or read step output.
    return {
      userId: session.user.id,
      orgIds: new Set(orgs.filter((o) => isOrgAdmin(o.role)).map((o) => o.id)),
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
})
