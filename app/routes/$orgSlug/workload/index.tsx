import {
  PageHeader,
  PageHeaderDescription,
  PageHeaderHeading,
  PageHeaderTitle,
} from '~/app/components/layout/page-header'
import { Stack } from '~/app/components/ui/stack'
import { getSelectedTeam } from '~/app/libs/team-cookie.server'
import { orgContext } from '~/app/middleware/context'
import { listTeams } from '~/app/routes/$orgSlug/settings/teams._index/queries.server'
import { TeamStacksChart } from './+components/team-stacks-chart'
import {
  DEFAULT_PERSONAL_LIMIT,
  aggregateTeamStacks,
} from './+functions/aggregate-stacks'
import {
  getOpenPullRequests,
  getPendingReviewAssignments,
} from './+functions/stacks.server'
import type { Route } from './+types/index'

export const loader = async ({ request, context }: Route.LoaderArgs) => {
  const { organization } = context.get(orgContext)

  const url = new URL(request.url)
  const teamParam = url.searchParams.get('team') ?? getSelectedTeam(request)

  const teams = await listTeams(organization.id)
  const selectedTeam = teamParam
    ? (teams.find((t) => t.id === teamParam) ?? null)
    : null
  const teamId = selectedTeam?.id ?? null
  const personalLimit = selectedTeam?.personalLimit ?? DEFAULT_PERSONAL_LIMIT

  const [openPRs, pendingReviews] = await Promise.all([
    getOpenPullRequests(organization.id, teamId),
    getPendingReviewAssignments(organization.id, teamId),
  ])

  return {
    openPRs,
    pendingReviews,
    personalLimit,
  }
}

export const clientLoader = async ({
  serverLoader,
}: Route.ClientLoaderArgs) => {
  const { openPRs, pendingReviews, personalLimit } = await serverLoader()

  return {
    teamStacks: aggregateTeamStacks(openPRs, pendingReviews, personalLimit),
  }
}
clientLoader.hydrate = true as const

export function HydrateFallback() {
  return (
    <Stack>
      <PageHeader>
        <PageHeaderHeading>
          <PageHeaderTitle>Review Stacks</PageHeaderTitle>
          <PageHeaderDescription>
            Monitor review workload balance across team members.
          </PageHeaderDescription>
        </PageHeaderHeading>
      </PageHeader>
    </Stack>
  )
}

export default function ReviewStacksPage({
  loaderData: { teamStacks },
}: Route.ComponentProps) {
  return (
    <Stack>
      <PageHeader>
        <PageHeaderHeading>
          <PageHeaderTitle>Review Stacks</PageHeaderTitle>
          <PageHeaderDescription>
            Monitor review workload balance across team members.
          </PageHeaderDescription>
        </PageHeaderHeading>
      </PageHeader>

      <TeamStacksChart data={teamStacks} />
    </Stack>
  )
}
