import { TZDate } from '@date-fns/tz'
import { addDays, format, subSeconds } from 'date-fns'
import { CopyIcon } from 'lucide-react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'
import { zx } from 'zodix'
import { AppDataTable } from '~/app/components'
import { Badge, Button, HStack, Label, Stack } from '~/app/components/ui'
import WeeklyCalendar from '~/app/components/week-calendar'
import type { Route } from './+types/route'
import { columns } from './columns'
import {
  getEndOfWeek,
  getMergedPullRequestReport,
  getStartOfWeek,
} from './functions.server'
import { generateMarkdown } from './functions/generate-markdown'
import { parseDate } from './functions/utils'

export type PullRequest = Awaited<
  ReturnType<typeof getMergedPullRequestReport>
>[0]

export const loader = async ({ request, params }: Route.LoaderArgs) => {
  const { organization: organizationId, objective } = zx.parseParams(params, {
    organization: z.string(),
    objective: z.number().min(0.1).max(30).optional().default(2.0),
  })

  const url = new URL(request.url)
  const fromParam = url.searchParams.get('from')
  const toParam = url.searchParams.get('to')

  let from: TZDate
  let to: TZDate
  if (fromParam && toParam) {
    // 検索パラメータの日付（JST）をUTCに変換
    from = parseDate(fromParam)
    to = subSeconds(addDays(parseDate(toParam), 1), 1)
  } else {
    // パラメータがない場合はデフォルト（現在の週）
    from = new TZDate(getStartOfWeek())
    to = new TZDate(getEndOfWeek())
  }

  const pullRequests = await getMergedPullRequestReport(
    organizationId,
    from.withTimeZone('UTC').toISOString(),
    to.withTimeZone('UTC').toISOString(),
    objective,
  )

  const achievementCount = pullRequests.filter((pr) => pr.achievement).length
  const achievementRate =
    pullRequests.length > 0 ? (achievementCount / pullRequests.length) * 100 : 0

  return {
    organizationId,
    pullRequests,
    from,
    to,
    objective,
    achievementCount,
    achievementRate,
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
  },
}: Route.ComponentProps) {
  const [, setSearchParams] = useSearchParams()

  return (
    <Stack>
      <div className="flex flex-col items-start gap-x-4 gap-y-2 md:flex-row">
        <HStack>
          <div>
            <div className="grid grid-cols-[auto_1fr] items-center gap-x-2">
              <div className="text-right">
                <Badge variant="outline">From</Badge>
              </div>
              <div className="text-sm">{format(from, 'yyyy-MM-dd HH:mm')}</div>
              <div className="text-right">
                <Badge variant="outline">To</Badge>
              </div>
              <div className="text-sm">{format(to, 'yyyy-MM-dd HH:mm')}</div>
            </div>
          </div>
          <WeeklyCalendar
            initialDate={from}
            onWeekChange={(start, end) => {
              setSearchParams((prev) => {
                prev.set('from', format(start, 'yyyy-MM-dd'))
                prev.set('to', format(end, 'yyyy-MM-dd'))
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

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full md:w-auto"
          onClick={() => {
            // markdown 表形式でコピー
            navigator.clipboard.writeText(generateMarkdown(pullRequests))
            toast.info(`Copied ${pullRequests.length} rows`)
          }}
        >
          <CopyIcon size="16" />
        </Button>
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
