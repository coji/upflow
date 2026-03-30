import { requireOrgMember } from '~/app/libs/auth.server'
import { getSelectedTeam } from '~/app/libs/team-cookie.server'
import { getOrganizationTimezone } from '~/app/libs/timezone.server'
import { listTeams } from '~/app/routes/$orgSlug/settings/teams._index/queries.server'
import type { Route } from '../routes/$orgSlug/+types/_layout'
import { orgContext, teamContext, timezoneContext } from './context'

export const orgMemberMiddleware: Route.MiddlewareFunction = async (
  { request, params, context },
  next,
) => {
  const org = await requireOrgMember(request, params.orgSlug)
  context.set(orgContext, org)
  const timezone = await getOrganizationTimezone(org.organization.id)
  context.set(timezoneContext, timezone)

  const url = new URL(request.url)
  const teams = await listTeams(org.organization.id)
  const teamFromUrl = url.searchParams.get('team')
  const teamFromCookie = getSelectedTeam(request)
  const selectedTeamId =
    [teamFromUrl, teamFromCookie].find(
      (id) => id && teams.some((t) => t.id === id),
    ) ?? null
  context.set(teamContext, selectedTeamId)

  return next()
}
