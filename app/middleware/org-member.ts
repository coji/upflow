import { requireOrgMember } from '~/app/libs/auth.server'
import { getOrganizationTimezone } from '~/app/libs/timezone.server'
import type { Route } from '../routes/$orgSlug/+types/_layout'
import { orgContext, timezoneContext } from './context'

export const orgMemberMiddleware: Route.MiddlewareFunction = async (
  { request, params, context },
  next,
) => {
  const org = await requireOrgMember(request, params.orgSlug)
  context.set(orgContext, org)
  const timezone = await getOrganizationTimezone(org.organization.id)
  context.set(timezoneContext, timezone)
  return next()
}
