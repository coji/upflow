import { useState } from 'react'
import {
  PageHeader,
  PageHeaderDescription,
  PageHeaderHeading,
  PageHeaderTitle,
} from '~/app/components/layout/page-header'
import { Stack } from '~/app/components/ui/stack'
import { isOrgAdmin } from '~/app/libs/member-role'
import { orgContext, teamContext } from '~/app/middleware/context'
import { PRHideByTitleFilterContext } from '~/app/routes/$orgSlug/+components/pr-block'
import { PrTitleFilterBanner } from '~/app/routes/$orgSlug/+components/pr-title-filter-banner'
import { PrTitleFilterSheet } from '~/app/routes/$orgSlug/+components/pr-title-filter-sheet'
import { listTeams } from '~/app/routes/$orgSlug/settings/teams._index/queries.server'
import { listEnabledPrTitleFilterPatterns } from '~/app/services/pr-title-filter-queries.server'
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

export const loader = async ({ context, request }: Route.LoaderArgs) => {
  const { organization, membership } = context.get(orgContext)

  const teamParam = context.get(teamContext)
  const url = new URL(request.url)
  const showFiltered = url.searchParams.get('showFiltered') === '1'

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

  const normalizedPatterns = showFiltered
    ? []
    : await listEnabledPrTitleFilterPatterns(organization.id)
  const filterActive = !showFiltered && normalizedPatterns.length > 0

  const [openPRs, pendingReviews, reviewHistory, excludedCount] =
    await Promise.all([
      getOpenPullRequests(organization.id, teamId, normalizedPatterns),
      getPendingReviewAssignments(organization.id, teamId, normalizedPatterns),
      getOpenPullRequestReviews(organization.id, teamId, normalizedPatterns),
      filterActive
        ? Promise.all([
            countOpenPullRequests(organization.id, teamId, []),
            countOpenPullRequests(organization.id, teamId, normalizedPatterns),
          ]).then(([unfiltered, filtered]) => unfiltered - filtered)
        : Promise.resolve(0),
    ])

  return {
    openPRs,
    pendingReviews,
    reviewHistory,
    personalLimit,
    excludedCount,
    filterActive,
    showFiltered,
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
    excludedCount,
    filterActive,
    showFiltered,
    isAdmin,
  } = await serverLoader()

  return {
    teamStacks: aggregateTeamStacks({
      openPRs,
      pendingReviews,
      reviewHistory,
      personalLimit,
    }),
    excludedCount,
    filterActive,
    showFiltered,
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
  loaderData: {
    teamStacks,
    excludedCount,
    filterActive,
    showFiltered,
    isAdmin,
  },
}: Route.ComponentProps) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetTitle, setSheetTitle] = useState<string | null>(null)
  const openSheet = isAdmin
    ? (title: string) => {
        setSheetTitle(title)
        setSheetOpen(true)
      }
    : null

  return (
    <PRHideByTitleFilterContext.Provider value={openSheet}>
      <Stack>
        <PageHeader>
          <PageHeaderHeading>
            <PageHeaderTitle>Review Stacks</PageHeaderTitle>
            <PageHeaderDescription>
              Monitor review workload balance across team members.
            </PageHeaderDescription>
          </PageHeaderHeading>
        </PageHeader>

        <PrTitleFilterBanner
          excludedCount={excludedCount}
          filterActive={filterActive}
          showFiltered={showFiltered}
          isAdmin={isAdmin}
        />

        <TeamStacksChart data={teamStacks} />
      </Stack>
      {isAdmin && (
        <PrTitleFilterSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          pullRequestTitle={sheetTitle}
        />
      )}
    </PRHideByTitleFilterContext.Provider>
  )
}
