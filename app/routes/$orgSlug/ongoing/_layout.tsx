import { CopyIcon } from 'lucide-react'
import { toast } from 'sonner'
import { AppDataTable } from '~/app/components'
import { Button, Stack } from '~/app/components/ui'
import { requireOrgMember } from '~/app/libs/auth.server'
import dayjs from '~/app/libs/dayjs'
import { columns } from './+columns'
import { generateMarkdown } from './+functions/generate-markdown'
import type { Route } from './+types/_layout'
import { getOngoingPullRequestReport } from './functions.server'

export const handle = {
  breadcrumb: () => ({
    label: 'Ongoing',
  }),
}

export type PullRequest = Awaited<
  ReturnType<typeof getOngoingPullRequestReport>
>[0]

export const loader = async ({ request, params }: Route.LoaderArgs) => {
  const { organization } = await requireOrgMember(request, params.orgSlug)
  const pullRequests = await getOngoingPullRequestReport(
    organization.id,
    null,
    dayjs().utc().toISOString(),
  )
  return { pullRequests }
}

export default function OngoingPage({
  loaderData: { pullRequests },
}: Route.ComponentProps) {
  return (
    <Stack>
      <div className="text-right">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full md:w-auto"
          onClick={() => {
            navigator.clipboard
              .writeText(generateMarkdown(pullRequests))
              .then(() => toast.info(`Copied ${pullRequests.length} rows`))
              .catch(() => toast.error('Failed to copy to clipboard'))
          }}
        >
          <CopyIcon size="16" />
        </Button>
      </div>

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
