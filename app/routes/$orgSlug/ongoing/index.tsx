import { CopyIcon } from 'lucide-react'
import { toast } from 'sonner'
import { AppDataTable } from '~/app/components'
import {
  PageHeader,
  PageHeaderActions,
  PageHeaderHeading,
  PageHeaderTitle,
} from '~/app/components/layout/page-header'
import { Button, Stack } from '~/app/components/ui'
import { requireOrgMember } from '~/app/libs/auth.server'
import dayjs from '~/app/libs/dayjs'
import { columns } from './+columns'
import { generateMarkdown } from './+functions/generate-markdown'
import type { Route } from './+types/index'
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
      <PageHeader>
        <PageHeaderHeading>
          <PageHeaderTitle>Ongoing</PageHeaderTitle>
        </PageHeaderHeading>
        <PageHeaderActions>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              navigator.clipboard
                .writeText(generateMarkdown(pullRequests))
                .then(() => toast.info(`Copied ${pullRequests.length} rows`))
                .catch(() => toast.error('Failed to copy to clipboard'))
            }}
          >
            <CopyIcon size="16" />
          </Button>
        </PageHeaderActions>
      </PageHeader>

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
