import { CopyIcon } from 'lucide-react'
import { toast } from 'sonner'
import { AppDataTable } from '~/app/components'
import {
  PageHeader,
  PageHeaderActions,
  PageHeaderHeading,
  PageHeaderTitle,
} from '~/app/components/layout/page-header'
import { TeamFilter } from '~/app/components/team-filter'
import { Button, Stack } from '~/app/components/ui'
import { requireOrgMember } from '~/app/libs/auth.server'
import dayjs from '~/app/libs/dayjs'
import { listTeams } from '../settings/teams._index/queries.server'
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

  const url = new URL(request.url)
  const teamParam = url.searchParams.get('team')

  const teams = await listTeams(organization.id)

  const pullRequests = await getOngoingPullRequestReport(
    organization.id,
    null,
    dayjs().utc().toISOString(),
    teamParam || undefined,
  )
  return { pullRequests, teams }
}

export default function OngoingPage({
  loaderData: { pullRequests, teams },
}: Route.ComponentProps) {
  return (
    <Stack>
      <PageHeader>
        <PageHeaderHeading>
          <PageHeaderTitle>Ongoing</PageHeaderTitle>
        </PageHeaderHeading>
        <PageHeaderActions>
          <TeamFilter teams={teams} />
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
        title={<div>Ongoing pull requests: {pullRequests.length}</div>}
        columns={columns}
        data={pullRequests}
      />
    </Stack>
  )
}
