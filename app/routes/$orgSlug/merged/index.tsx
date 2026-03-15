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
import { Button, Label, Stack } from '~/app/components/ui'
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

  return {
    pullRequests,
    from: from.toISOString(),
    to: to.toISOString(),
    objective,
    achievementCount,
    achievementRate,
    teams,
    businessDaysOnly,
  }
}

export default function OrganizationIndex({
  loaderData: {
    pullRequests,
    from,
    to,
    objective,
    achievementCount,
    achievementRate,
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

      <div className="flex flex-col items-start gap-x-4 gap-y-2 md:flex-row">
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

        <div className="flex-1" />

        <div>
          <Label>Objective</Label>
          <div className="grid grid-cols-2 gap-x-4">
            <div>Time to Merge</div>
            <div>
              {'< '}
              {objective.toFixed(1)}
              <small>d</small>
            </div>
            <div>Achievement</div>
            <div>
              {achievementRate.toFixed(1)}
              <small>% ({achievementCount.toLocaleString()})</small>
            </div>
          </div>
        </div>
      </div>

      <AppDataTable
        title={
          <div>
            Merged {dayjs(from).tz(timezone).format('M/D')} -{' '}
            {dayjs(to).tz(timezone).format('M/D')}: {pullRequests.length}
          </div>
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
      />
    </Stack>
  )
}
