import { z } from 'zod'
import { zx } from 'zodix'
import { AppDataTable } from '~/app/components'
import { Button, HStack, Stack, useToast } from '~/app/components/ui'
import dayjs from '~/app/libs/dayjs'
import type { Route } from './+types/route'
import { columns } from './columns'
import { getOngoingPullRequestReport } from './functions.server'
import { generateMarkdown } from './functions/generate-markdown'

export type PullRequest = Awaited<
  ReturnType<typeof getOngoingPullRequestReport>
>[0]

export const loader = async ({ params }: Route.LoaderArgs) => {
  const { company: companyId } = zx.parseParams(params, {
    company: z.string(),
  })
  const from = null
  const to = dayjs().utc().toISOString()

  const pullRequests = await getOngoingPullRequestReport(companyId, from, to)
  return { companyId, pullRequests, from, to }
}

export default function OngoingPage({
  loaderData: { pullRequests, from, to },
}: Route.ComponentProps) {
  const toast = useToast()

  return (
    <Stack>
      <HStack>
        <div className="grid flex-1 grid-cols-2">
          <div>From</div>
          <div>{from}</div>
          <div>To</div>
          <div>{to}</div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            // markdown 表形式でコピー
            navigator.clipboard.writeText(generateMarkdown(pullRequests))
            toast.toast({ title: `Copied ${pullRequests.length} rows` })
          }}
        >
          Copy
        </Button>
      </HStack>

      <AppDataTable
        title={
          <div>
            進行中のプルリクエスト {pullRequests.length}
            <small>件</small>
          </div>
        }
        columns={columns}
        data={pullRequests}
      />
    </Stack>
  )
}
