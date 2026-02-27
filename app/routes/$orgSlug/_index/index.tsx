import { CopyIcon } from 'lucide-react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { AppDataTable } from '~/app/components'
import {
  PageHeader,
  PageHeaderActions,
  PageHeaderHeading,
  PageHeaderTitle,
} from '~/app/components/layout/page-header'
import { TeamFilter } from '~/app/components/team-filter'
import { Badge, Button, HStack, Label, Stack } from '~/app/components/ui'
import WeeklyCalendar from '~/app/components/week-calendar'
import { requireOrgMember } from '~/app/libs/auth.server'
import dayjs from '~/app/libs/dayjs'
import { listTeams } from '../settings/teams._index/queries.server'
import { columns } from './+columns'
import { generateMarkdown } from './+functions/generate-markdown'
import { getEndOfWeek, getStartOfWeek, parseDate } from './+functions/utils'
import type { Route } from './+types/index'
import { getMergedPullRequestReport } from './functions.server'

export type PullRequest = Awaited<
  ReturnType<typeof getMergedPullRequestReport>
>[0]

export const loader = async ({ request, params }: Route.LoaderArgs) => {
  const { organization } = await requireOrgMember(request, params.orgSlug)
  const objective = 2.0

  const url = new URL(request.url)
  const fromParam = url.searchParams.get('from')
  const toParam = url.searchParams.get('to')
  const teamParam = url.searchParams.get('team')

  let from: dayjs.Dayjs
  let to: dayjs.Dayjs
  if (fromParam && toParam) {
    from = parseDate(fromParam)
    to = parseDate(toParam).add(1, 'day').subtract(1, 'second')
  } else {
    from = getStartOfWeek()
    to = getEndOfWeek()
  }

  const teams = await listTeams(organization.id)

  const pullRequests = await getMergedPullRequestReport(
    organization.id,
    from.utc().toISOString(),
    to.utc().toISOString(),
    objective,
    teamParam || undefined,
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
  },
}: Route.ComponentProps) {
  const [, setSearchParams] = useSearchParams()

  return (
    <Stack>
      <PageHeader>
        <PageHeaderHeading>
          <PageHeaderTitle>Dashboard</PageHeaderTitle>
        </PageHeaderHeading>
        <PageHeaderActions>
          <TeamFilter teams={teams} />
          <Button
            type="button"
            variant="outline"
            size="sm"
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
        <HStack>
          <div>
            <div className="grid grid-cols-[auto_1fr] items-center gap-x-2">
              <div className="text-right">
                <Badge variant="outline">From</Badge>
              </div>
              <div className="text-sm">
                {dayjs(from).format('YYYY-MM-DD HH:mm')}
              </div>
              <div className="text-right">
                <Badge variant="outline">To</Badge>
              </div>
              <div className="text-sm">
                {dayjs(to).format('YYYY-MM-DD HH:mm')}
              </div>
            </div>
          </div>
          <WeeklyCalendar
            initialDate={dayjs(from).toDate()}
            onWeekChange={(start, end) => {
              setSearchParams((prev) => {
                prev.set('from', dayjs(start).format('YYYY-MM-DD'))
                prev.set('to', dayjs(end).format('YYYY-MM-DD'))
                return prev
              })
            }}
          />
        </HStack>

        <div className="flex-1" />

        <div>
          <Label>目標</Label>
          <div className="grid grid-cols-2 gap-x-4">
            <div>マージまで</div>
            <div>
              {objective.toFixed(1)}
              <small>日未満</small>
            </div>
            <div>達成率</div>
            <div>
              {achievementRate.toFixed(1)}
              <small>% ({achievementCount.toLocaleString()}件)</small>
            </div>
          </div>
        </div>
      </div>

      <AppDataTable
        title={
          <div>
            今週マージされたプルリクエスト {pullRequests.length}{' '}
            <small>件</small>
          </div>
        }
        columns={columns}
        data={pullRequests}
      />
    </Stack>
  )
}
