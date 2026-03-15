import { CopyIcon } from 'lucide-react'
import { useMemo } from 'react'
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
import { Button, Stack } from '~/app/components/ui'
import {
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
} from '~/app/components/ui/dropdown-menu'
import { useTimezone } from '~/app/hooks/use-timezone'
import dayjs from '~/app/libs/dayjs'
import { orgContext } from '~/app/middleware/context'
import { listTeams } from '../settings/teams._index/queries.server'
import { createColumns } from './+columns'
import { generateMarkdown } from './+functions/generate-markdown'
import { getOngoingPullRequestReport } from './+functions/queries.server'
import type { Route } from './+types/index'

export const handle = {
  breadcrumb: () => ({
    label: 'Ongoing',
  }),
}

export type PullRequest = Awaited<
  ReturnType<typeof getOngoingPullRequestReport>
>[0]

export const loader = async ({ request, context }: Route.LoaderArgs) => {
  const { organization } = context.get(orgContext)

  const url = new URL(request.url)
  const teamParam = url.searchParams.get('team')
  const businessDaysOnly = url.searchParams.get('businessDays') !== '0'

  const teams = await listTeams(organization.id)

  const pullRequests = await getOngoingPullRequestReport(
    organization.id,
    null,
    dayjs().utc().toISOString(),
    teamParam || undefined,
    businessDaysOnly,
  )
  return { pullRequests, teams, businessDaysOnly }
}

export default function OngoingPage({
  loaderData: { pullRequests, teams, businessDaysOnly },
}: Route.ComponentProps) {
  const [, setSearchParams] = useSearchParams()
  const timezone = useTimezone()
  const columns = useMemo(() => createColumns(timezone), [timezone])

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
