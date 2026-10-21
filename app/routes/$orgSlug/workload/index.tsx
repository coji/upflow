import {
  PageHeader,
  PageHeaderActions,
  PageHeaderDescription,
  PageHeaderHeading,
  PageHeaderTitle,
} from '~/app/components/layout/page-header'
import { Stack } from '~/app/components/ui/stack'
import { isOrgAdmin } from '~/app/libs/member-role'
import {
  loadHiddenPrSummary,
  filterCacheKeySuffix,
  loadPrFilterState,
} from '~/app/libs/pr-title-filter.server'
import { orgContext, teamContext } from '~/app/middleware/context'
import { HiddenPrsMenu } from '~/app/routes/$orgSlug/+components/hidden-prs-menu'
import { listTeams } from '~/app/routes/$orgSlug/settings/teams._index/queries.server'
import { getOrgCachedData } from '~/app/services/cache.server'
import { TeamStacksChart } from './+components/team-stacks-chart'
import {
  DEFAULT_PERSONAL_LIMIT,
  aggregateTeamStacks,
} from './+functions/aggregate-stacks'
import {
  countOpenPullRequests,
  getOpenPullRequestReviews,
  getOpenPullRequests,
  getPendingReviewAssignments,
} from './+functions/stacks.server'
import type { Route } from './+types/index'

export const loader = async ({ context, url }: Route.LoaderArgs) => {
  const { organization, membership } = context.get(orgContext)

  const teamParam = context.get(teamContext)

  const teams = await listTeams(organization.id)
  const selectedTeam = teamParam
    ? (teams.find((t) => t.id === teamParam) ?? null)
    : null
  const teamId = selectedTeam?.id ?? null
  const personalLimit = selectedTeam
    ? selectedTeam.personalLimit
    : teams.length > 0
      ? Math.max(...teams.map((t) => t.personalLimit))
      : DEFAULT_PERSONAL_LIMIT

  const filter = await loadPrFilterState(url, organization.id)
  const hideDrafts = url.searchParams.get('hideDrafts') === '1'

  const cacheKey = `workload:${teamId ?? 'all'}:${filterCacheKeySuffix(filter)}:hd=${hideDrafts ? '1' : '0'}`
  const SIXTY_SECONDS = 60 * 1000

  const [[openPRs, pendingReviews, reviewHistory], hiddenPrs] =
    await Promise.all([
      getOrgCachedData(
        organization.id,
        cacheKey,
        () =>
          Promise.all([
            getOpenPullRequests(
              organization.id,
              teamId,
              filter.normalizedPatterns,
              hideDrafts,
              filter.prTypes,
            ),
            getPendingReviewAssignments(
              organization.id,
              teamId,
              filter.normalizedPatterns,
              hideDrafts,
              filter.prTypes,
            ),
            getOpenPullRequestReviews(
              organization.id,
              teamId,
              filter.normalizedPatterns,
              hideDrafts,
              filter.prTypes,
            ),
          ]),
        SIXTY_SECONDS,
      ),
      loadHiddenPrSummary(
        filter,
        (breakdown) =>
          countOpenPullRequests(organization.id, teamId, breakdown),
        { hideDrafts },
      ),
    ])

  return {
    openPRs,
    pendingReviews,
    reviewHistory,
    personalLimit,
    hiddenPrs,
    isAdmin: isOrgAdmin(membership.role),
  }
}

export const clientLoader = async ({
  serverLoader,
}: Route.ClientLoaderArgs) => {
  const {
    openPRs,
    pendingReviews,
    reviewHistory,
    personalLimit,
    hiddenPrs,
    isAdmin,
  } = await serverLoader()

  return {
    teamStacks: aggregateTeamStacks({
      openPRs,
      pendingReviews,
      reviewHistory,
      personalLimit,
    }),
    hiddenPrs,
    isAdmin,
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
  loaderData: { teamStacks, hiddenPrs, isAdmin },
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
          <HiddenPrsMenu summary={hiddenPrs} isAdmin={isAdmin} />
        </PageHeaderActions>
      </PageHeader>

      <TeamStacksChart data={teamStacks} />
    </Stack>
  )
}
