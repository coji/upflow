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
import WeeklyCalendar from '~/app/components/week-calendar'
import { useTimezone } from '~/app/hooks/use-timezone'
import { getEndOfWeek, getStartOfWeek, parseDate } from '~/app/libs/date-utils'
import dayjs from '~/app/libs/dayjs'
import { isOrgAdmin } from '~/app/libs/member-role'
import {
  computeExcludedCount,
  loadPrFilterState,
} from '~/app/libs/pr-title-filter.server'
import {
  orgContext,
  teamContext,
  timezoneContext,
} from '~/app/middleware/context'
import { PrTitleFilterStatus } from '~/app/routes/$orgSlug/+components/pr-title-filter-status'
import { DiffBadge } from '../+components/diff-badge'
import { StatCard } from '../+components/stat-card'
import { calcStats } from '../+functions/calc-stats'
import { createColumns } from './+columns'
import {
  countDeployedPullRequests,
  getDeployedPullRequestReport,
} from './+functions/queries.server'
import type { Route } from './+types/index'

export const handle = {
  breadcrumb: () => ({ label: 'Deployed' }),
}

export type PullRequest = Awaited<
  ReturnType<typeof getDeployedPullRequestReport>
>[0]

export const loader = async ({ request, context }: Route.LoaderArgs) => {
  const { organization, membership } = context.get(orgContext)
  const objective = 3.0
  const timezone = context.get(timezoneContext)

  const url = new URL(request.url)
  const fromParam = url.searchParams.get('from')
  const toParam = url.searchParams.get('to')
  const teamParam = context.get(teamContext)
  const businessDaysOnly = url.searchParams.get('businessDays') !== '0'

  let from: dayjs.Dayjs
  let to: dayjs.Dayjs
  if (fromParam && toParam) {
    from = parseDate(fromParam, timezone)
    to = parseDate(toParam, timezone).add(1, 'day').subtract(1, 'second')
  } else {
    from = getStartOfWeek(undefined, timezone)
    to = getEndOfWeek(undefined, timezone)
  }

  const prevFrom = from.subtract(7, 'day')
  const prevTo = to.subtract(7, 'day')

  const filter = await loadPrFilterState(request, organization.id)

  const fromIso = from.utc().toISOString()
  const toIso = to.utc().toISOString()

  const [pullRequests, prevPullRequests, excludedCount] = await Promise.all([
    getDeployedPullRequestReport(
      organization.id,
      fromIso,
      toIso,
      objective,
      teamParam || undefined,
      businessDaysOnly,
      filter.normalizedPatterns,
    ),
    getDeployedPullRequestReport(
      organization.id,
      prevFrom.utc().toISOString(),
      prevTo.utc().toISOString(),
      objective,
      teamParam || undefined,
      businessDaysOnly,
      filter.normalizedPatterns,
    ),
    computeExcludedCount(filter, (patterns) =>
      countDeployedPullRequests(
        organization.id,
        fromIso,
        toIso,
        teamParam || undefined,
        patterns,
      ),
    ),
  ])

  const stats = calcStats(pullRequests, (pr) => pr.createAndDeployDiff)
  const prev = calcStats(prevPullRequests, (pr) => pr.createAndDeployDiff)

  return {
    pullRequests,
    from: from.toISOString(),
    objective,
    ...stats,
    prev,
    businessDaysOnly,
    excludedCount,
    filterActive: filter.filterActive,
    showFiltered: filter.showFiltered,
    isAdmin: isOrgAdmin(membership.role),
  }
}

export default function DeployedPage({
  loaderData: {
    pullRequests,
    from,
    objective,
    count,
    achievementRate,
    median,
    prev,
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
          <PageHeaderTitle>Deployed</PageHeaderTitle>
          <PageHeaderDescription>
            Pull requests deployed this week with cycle time metrics.
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
        title={
          <WeeklyCalendar
            value={from}
            onWeekChange={(start) => {
              setSearchParams((prev) => {
                prev.set('from', dayjs(start).tz(timezone).format('YYYY-MM-DD'))
                prev.set(
                  'to',
                  dayjs(start).tz(timezone).add(6, 'day').format('YYYY-MM-DD'),
                )
                return prev
              })
            }}
          />
        }
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
        <div className="grid grid-cols-3 gap-4">
          <StatCard value={count} label="Deployed">
            <DiffBadge
              value={count}
              prevValue={prev.count}
              format={(d) => `${d >= 0 ? '+' : ''}${d}`}
            />
          </StatCard>
          <StatCard
            value={median !== null ? `${median.toFixed(1)}d` : '–'}
            label="Median Time to Deploy"
          >
            {median !== null && (
              <DiffBadge
                value={median}
                prevValue={prev.median}
                format={(d) => `${d >= 0 ? '+' : ''}${d.toFixed(1)}d`}
                invertColor
              />
            )}
          </StatCard>
          <StatCard
            value={`${achievementRate.toFixed(1)}%`}
            label="Achievement"
          >
            <DiffBadge
              value={achievementRate}
              prevValue={prev.achievementRate}
              format={(d) => `${d >= 0 ? '+' : ''}${d.toFixed(1)}%`}
            />
            <div className="text-muted-foreground/70 text-xs">
              Goal {'< '}
              {objective.toFixed(1)}d
            </div>
          </StatCard>
        </div>
      </AppDataTable>
    </Stack>
  )
}
