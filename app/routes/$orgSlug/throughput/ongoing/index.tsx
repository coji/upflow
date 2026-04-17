import { useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { AppDataTable } from '~/app/components'
import {
  PageHeader,
  PageHeaderActions,
  PageHeaderDescription,
  PageHeaderHeading,
  PageHeaderTitle,
} from '~/app/components/layout/page-header'
import { Stack } from '~/app/components/ui'
import {
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
} from '~/app/components/ui/dropdown-menu'
import { useTimezone } from '~/app/hooks/use-timezone'
import dayjs from '~/app/libs/dayjs'
import { isOrgAdmin } from '~/app/libs/member-role'
import {
  computeExcludedCount,
  loadPrFilterState,
} from '~/app/libs/pr-title-filter.server'
import { median as calcMedian } from '~/app/libs/stats'
import { orgContext, teamContext } from '~/app/middleware/context'
import { PrTitleFilterStatus } from '~/app/routes/$orgSlug/+components/pr-title-filter-status'
import { StatCard } from '../+components/stat-card'
import { createColumns } from './+columns'
import {
  countOngoingPullRequests,
  getOngoingPullRequestReport,
} from './+functions/queries.server'
import type { Route } from './+types/index'

export const handle = {
  breadcrumb: () => ({
    label: 'Ongoing',
  }),
}

export type PullRequest = Awaited<
  ReturnType<typeof getOngoingPullRequestReport>
>[0]

export const loader = async ({ request, context }: Route.LoaderArgs) => {
  const { organization, membership } = context.get(orgContext)

  const url = new URL(request.url)
  const teamParam = context.get(teamContext)
  const businessDaysOnly = url.searchParams.get('businessDays') !== '0'

  const toIso = dayjs().utc().toISOString()
  const filter = await loadPrFilterState(request, organization.id)

  const [pullRequests, excludedCount] = await Promise.all([
    getOngoingPullRequestReport(
      organization.id,
      null,
      toIso,
      teamParam || undefined,
      businessDaysOnly,
      filter.normalizedPatterns,
    ),
    computeExcludedCount(filter, (patterns) =>
      countOngoingPullRequests(
        organization.id,
        null,
        toIso,
        teamParam || undefined,
        patterns,
      ),
    ),
  ])

  const ages = pullRequests
    .map((pr) => pr.createAndNowDiff)
    .filter((v): v is number => v !== null)
  const median = calcMedian(ages)

  return {
    pullRequests,
    median,
    businessDaysOnly,
    excludedCount,
    filterActive: filter.filterActive,
    showFiltered: filter.showFiltered,
    isAdmin: isOrgAdmin(membership.role),
  }
}

export default function OngoingPage({
  loaderData: {
    pullRequests,
    median,
    businessDaysOnly,
    excludedCount,
    filterActive,
    showFiltered,
    isAdmin,
  },
  params: { orgSlug },
}: Route.ComponentProps) {
  const [, setSearchParams] = useSearchParams()
  const timezone = useTimezone()
  const columns = useMemo(
    () => createColumns(timezone, orgSlug),
    [timezone, orgSlug],
  )

  return (
    <Stack>
      <PageHeader>
        <PageHeaderHeading>
          <PageHeaderTitle>Ongoing</PageHeaderTitle>
          <PageHeaderDescription>
            Pull requests currently in progress.
          </PageHeaderDescription>
        </PageHeaderHeading>
        <PageHeaderActions>
          <PrTitleFilterStatus
            excludedCount={excludedCount}
            filterActive={filterActive}
            showFiltered={showFiltered}
            isAdmin={isAdmin}
          />
        </PageHeaderActions>
      </PageHeader>

      <AppDataTable
        columns={columns}
        data={pullRequests}
        getRowId={(row) => `${row.repositoryId}:${row.number}`}
        optionsChildren={
          <>
            <DropdownMenuLabel>Duration</DropdownMenuLabel>
            <DropdownMenuCheckboxItem
              checked={businessDaysOnly}
              onCheckedChange={(checked) => {
                setSearchParams((prev) => {
                  if (checked) {
                    prev.delete('businessDays')
                  } else {
                    prev.set('businessDays', '0')
                  }
                  return prev
                })
              }}
            >
              Business days only
            </DropdownMenuCheckboxItem>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <StatCard value={pullRequests.length} label="Ongoing" />
          <StatCard
            value={median !== null ? `${median.toFixed(1)}d` : '–'}
            label="Median Age"
          />
        </div>
      </AppDataTable>
    </Stack>
  )
}
