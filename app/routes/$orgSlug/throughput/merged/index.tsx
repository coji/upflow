import { CopyIcon } from 'lucide-react'
import { useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { AppDataTable } from '~/app/components'
import {
  PageHeader,
  PageHeaderActions,
  PageHeaderDescription,
  PageHeaderHeading,
  PageHeaderTitle,
} from '~/app/components/layout/page-header'
import { TeamFilter } from '~/app/components/team-filter'
import { Button, Stack } from '~/app/components/ui'
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
import { generateMarkdown } from './+functions/generate-markdown'
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

  const teams = await listTeams(organization.id)

  const pullRequests = await getMergedPullRequestReport(
    organization.id,
    from.utc().toISOString(),
    to.utc().toISOString(),
    objective,
    teamParam || undefined,
    businessDaysOnly,
  )

  const achievementCount = pullRequests.filter((pr) => pr.achievement).length
  const achievementRate =
    pullRequests.length > 0 ? (achievementCount / pullRequests.length) * 100 : 0

  const mergeTimes = pullRequests
    .map((pr) => pr.createAndMergeDiff)
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b)
  const median =
    mergeTimes.length > 0
      ? mergeTimes.length % 2 === 1
        ? mergeTimes[Math.floor(mergeTimes.length / 2)]
        : (mergeTimes[mergeTimes.length / 2 - 1] +
            mergeTimes[mergeTimes.length / 2]) /
          2
      : null

  return {
    pullRequests,
    from: from.toISOString(),
    objective,
    achievementRate,
    median,
    teams,
    businessDaysOnly,
  }
}

export default function OrganizationIndex({
  loaderData: {
    pullRequests,
    from,
    objective,
    achievementRate,
    median,
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
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={`Copy ${pullRequests.length} rows as markdown`}
            onClick={() => {
              navigator.clipboard.writeText(generateMarkdown(pullRequests))
              toast.info(`Copied ${pullRequests.length} rows`)
            }}
          >
            <CopyIcon size="16" />
          </Button>
        </PageHeaderActions>
      </PageHeader>

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

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border p-4 text-center">
          <div className="text-3xl font-bold">{pullRequests.length}</div>
          <div className="text-muted-foreground text-sm">Merged</div>
        </div>
        <div className="rounded-lg border p-4 text-center">
          <div className="text-3xl font-bold">
            {median !== null ? `${median.toFixed(1)}d` : '–'}
          </div>
          <div className="text-muted-foreground text-sm">
            Median Time to Merge
          </div>
        </div>
        <div className="rounded-lg border p-4 text-center">
          <div className="text-3xl font-bold">
            {achievementRate.toFixed(1)}%
          </div>
          <div className="text-muted-foreground text-sm">Achievement</div>
          <div className="text-muted-foreground/70 text-xs">
            Goal {'< '}
            {objective.toFixed(1)}d
          </div>
        </div>
      </div>

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
      />
    </Stack>
  )
}
