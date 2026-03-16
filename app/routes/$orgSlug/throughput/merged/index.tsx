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
import { TeamFilter } from '~/app/components/team-filter'
import { Stack } from '~/app/components/ui'
import {
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
} from '~/app/components/ui/dropdown-menu'
import WeeklyCalendar from '~/app/components/week-calendar'
import { useTimezone } from '~/app/hooks/use-timezone'
import { getEndOfWeek, getStartOfWeek, parseDate } from '~/app/libs/date-utils'
import dayjs from '~/app/libs/dayjs'
import { orgContext, timezoneContext } from '~/app/middleware/context'
import { listTeams } from '~/app/routes/$orgSlug/settings/teams._index/queries.server'
import { createColumns } from './+columns'
import { getMergedPullRequestReport } from './+functions/queries.server'
import type { Route } from './+types/index'

export const handle = {
  breadcrumb: () => ({ label: 'Merged' }),
}

export type PullRequest = Awaited<
  ReturnType<typeof getMergedPullRequestReport>
>[0]

export const loader = async ({ request, context }: Route.LoaderArgs) => {
  const { organization } = context.get(orgContext)
  const objective = 2.0
  const timezone = context.get(timezoneContext)

  const url = new URL(request.url)
  const fromParam = url.searchParams.get('from')
  const toParam = url.searchParams.get('to')
  const teamParam = url.searchParams.get('team')
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

  const [teams, pullRequests, prevPullRequests] = await Promise.all([
    listTeams(organization.id),
    getMergedPullRequestReport(
      organization.id,
      from.utc().toISOString(),
      to.utc().toISOString(),
      objective,
      teamParam || undefined,
      businessDaysOnly,
    ),
    getMergedPullRequestReport(
      organization.id,
      prevFrom.utc().toISOString(),
      prevTo.utc().toISOString(),
      objective,
      teamParam || undefined,
      businessDaysOnly,
    ),
  ])

  const calcStats = (prs: typeof pullRequests) => {
    const achievementCount = prs.filter((pr) => pr.achievement).length
    const achievementRate =
      prs.length > 0 ? (achievementCount / prs.length) * 100 : 0
    const times = prs
      .map((pr) => pr.createAndMergeDiff)
      .filter((v): v is number => v !== null)
      .sort((a, b) => a - b)
    const median =
      times.length > 0
        ? times.length % 2 === 1
          ? times[Math.floor(times.length / 2)]
          : (times[times.length / 2 - 1] + times[times.length / 2]) / 2
        : null
    return { count: prs.length, achievementRate, median }
  }

  const stats = calcStats(pullRequests)
  const prevStats = calcStats(prevPullRequests)

  return {
    pullRequests,
    from: from.toISOString(),
    objective,
    ...stats,
    prev: prevStats,
    teams,
    businessDaysOnly,
  }
}

function DiffBadge({
  value,
  prevValue,
  format = (v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}`,
  invertColor = false,
}: {
  value: number
  prevValue: number | null
  format?: (diff: number) => string
  invertColor?: boolean
}) {
  if (prevValue === null) return null
  const diff = value - prevValue
  if (diff === 0) return null
  const isPositive = invertColor ? diff < 0 : diff > 0
  return (
    <span
      className={`text-xs font-medium ${isPositive ? 'text-emerald-600' : 'text-red-500'}`}
    >
      {format(diff)}
    </span>
  )
}

export default function OrganizationIndex({
  loaderData: {
    pullRequests,
    from,
    objective,
    count,
    achievementRate,
    median,
    prev,
    teams,
    businessDaysOnly,
  },
}: Route.ComponentProps) {
  const [, setSearchParams] = useSearchParams()
  const timezone = useTimezone()
  const columns = useMemo(() => createColumns(timezone), [timezone])

  return (
    <Stack>
      <PageHeader>
        <PageHeaderHeading>
          <PageHeaderTitle>Merged</PageHeaderTitle>
          <PageHeaderDescription>
            Pull requests merged this week with cycle time metrics.
          </PageHeaderDescription>
        </PageHeaderHeading>
        <PageHeaderActions>
          <TeamFilter teams={teams} />
        </PageHeaderActions>
      </PageHeader>

      <AppDataTable
        title={
          <WeeklyCalendar
            value={from}
            onWeekChange={(start) => {
              setSearchParams((prev) => {
                prev.set('from', dayjs(start).format('YYYY-MM-DD'))
                prev.set('to', dayjs(start).add(6, 'day').format('YYYY-MM-DD'))
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
          <div className="rounded-lg border p-4 text-center">
            <div className="text-3xl font-bold">{count}</div>
            <div className="text-muted-foreground text-sm">Merged</div>
            <DiffBadge
              value={count}
              prevValue={prev.count}
              format={(d) => `${d >= 0 ? '+' : ''}${d}`}
            />
          </div>
          <div className="rounded-lg border p-4 text-center">
            <div className="text-3xl font-bold">
              {median !== null ? `${median.toFixed(1)}d` : '–'}
            </div>
            <div className="text-muted-foreground text-sm">
              Median Time to Merge
            </div>
            {median !== null && (
              <DiffBadge
                value={median}
                prevValue={prev.median}
                format={(d) => `${d >= 0 ? '+' : ''}${d.toFixed(1)}d`}
                invertColor
              />
            )}
          </div>
          <div className="rounded-lg border p-4 text-center">
            <div className="text-3xl font-bold">
              {achievementRate.toFixed(1)}%
            </div>
            <div className="text-muted-foreground text-sm">Achievement</div>
            <DiffBadge
              value={achievementRate}
              prevValue={prev.achievementRate}
              format={(d) => `${d >= 0 ? '+' : ''}${d.toFixed(1)}%`}
            />
            <div className="text-muted-foreground/70 text-xs">
              Goal {'< '}
              {objective.toFixed(1)}d
            </div>
          </div>
        </div>
      </AppDataTable>
    </Stack>
  )
}
