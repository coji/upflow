import {
  PageHeader,
  PageHeaderActions,
  PageHeaderDescription,
  PageHeaderHeading,
  PageHeaderTitle,
} from '~/app/components/layout/page-header'
import { TeamFilter } from '~/app/components/team-filter'
import { Stack } from '~/app/components/ui/stack'
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
  const teamParam = url.searchParams.get('team')

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
    teams,
    openPRs,
    pendingReviews,
    personalLimit,
  }
}

export const clientLoader = async ({
  serverLoader,
}: Route.ClientLoaderArgs) => {
  const { teams, openPRs, pendingReviews, personalLimit } = await serverLoader()

  return {
    teams,
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
  loaderData: { teams, teamStacks },
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
        <PageHeaderActions>
          <TeamFilter teams={teams} />
        </PageHeaderActions>
      </PageHeader>

      <TeamStacksChart data={teamStacks} />
    </Stack>
  )
}
