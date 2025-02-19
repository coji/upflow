import { CopyIcon } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'
import { zx } from 'zodix'
import { AppDataTable } from '~/app/components'
import { Badge, Button, Label, Stack } from '~/app/components/ui'
import dayjs from '~/app/libs/dayjs'
import type { Route } from './+types/route'
import { columns } from './columns'
import { getMergedPullRequestReport, getStartOfWeek } from './functions.server'
import { generateMarkdown } from './functions/generate-markdown'

export type PullRequest = Awaited<
  ReturnType<typeof getMergedPullRequestReport>
>[0]

export const loader = async ({ params }: Route.LoaderArgs) => {
  const { company: companyId, objective } = zx.parseParams(params, {
    company: z.string(),
    objective: z.number().min(0.1).max(30).optional().default(2.0),
  })

  const from = getStartOfWeek().toISOString()
  const to = dayjs().utc().toISOString()
  const pullRequests = await getMergedPullRequestReport(
    companyId,
    from,
    to,
    objective,
  )

  const achievementCount = pullRequests.filter((pr) => pr.achievement).length
  const achievementRate =
    pullRequests.length > 0 ? (achievementCount / pullRequests.length) * 100 : 0

  return {
    companyId,
    pullRequests,
    from,
    to,
    objective,
    achievementCount,
    achievementRate,
  }
}

export default function CompanyIndex({
  loaderData: {
    pullRequests,
    from,
    to,
    objective,
    achievementCount,
    achievementRate,
  },
}: Route.ComponentProps) {
  return (
    <Stack>
      <div className="flex flex-col items-start gap-x-4 gap-y-2 md:flex-row">
        <div>
          <Label>期間</Label>
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
