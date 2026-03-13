import {
  PageHeader,
  PageHeaderActions,
  PageHeaderHeading,
  PageHeaderTitle,
} from '~/app/components/layout/page-header'
import { TeamFilter } from '~/app/components/team-filter'
import { Stack } from '~/app/components/ui/stack'
import { requireOrgMember } from '~/app/libs/auth.server'
import { listTeams } from '~/app/routes/$orgSlug/settings/teams._index/queries.server'
import { TeamStacksChart } from './+components/team-stacks-chart'
import { aggregateTeamStacks } from './+functions/aggregate-stacks'
import {
  getOpenPullRequests,
  getPendingReviewAssignments,
} from './+functions/stacks.server'
import type { Route } from './+types/index'

export const loader = async ({ request, params }: Route.LoaderArgs) => {
  const { organization } = await requireOrgMember(request, params.orgSlug)

  const url = new URL(request.url)
  const teamParam = url.searchParams.get('team')

  const [teams, openPRs, pendingReviews] = await Promise.all([
    listTeams(organization.id),
    getOpenPullRequests(organization.id, teamParam),
    getPendingReviewAssignments(organization.id, teamParam),
  ])

  return {
    teams,
    openPRs,
    pendingReviews,
  }
}

export const clientLoader = async ({
  serverLoader,
}: Route.ClientLoaderArgs) => {
  const { teams, openPRs, pendingReviews } = await serverLoader()

  return {
    teams,
    teamStacks: aggregateTeamStacks(openPRs, pendingReviews),
  }
}
clientLoader.hydrate = true as const

export function HydrateFallback() {
  return (
    <Stack gap="6">
      <PageHeader>
        <PageHeaderHeading>
          <PageHeaderTitle>Review Stacks</PageHeaderTitle>
        </PageHeaderHeading>
      </PageHeader>
    </Stack>
  )
}

export default function ReviewStacksPage({
  loaderData: { teams, teamStacks },
}: Route.ComponentProps) {
  return (
    <Stack gap="6">
      <PageHeader>
        <PageHeaderHeading>
          <PageHeaderTitle>Review Stacks</PageHeaderTitle>
        </PageHeaderHeading>
        <PageHeaderActions>
          <TeamFilter teams={teams} />
        </PageHeaderActions>
      </PageHeader>

      <TeamStacksChart data={teamStacks} />
    </Stack>
  )
}
