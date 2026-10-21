import { useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { AppDataTable } from '~/app/components'
import {
  PageHeader,
  PageHeaderActions,
  PageHeaderDescription,
  PageHeaderHeading,
  PageHeaderTitle,
} from '~/app/components/layout/page-header'
import { Stack } from '~/app/components/ui'
import {
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
} from '~/app/components/ui/dropdown-menu'
import { useTimezone } from '~/app/hooks/use-timezone'
import dayjs from '~/app/libs/dayjs'
import { isOrgAdmin } from '~/app/libs/member-role'
import {
  loadHiddenPrSummary,
  loadPrFilterState,
} from '~/app/libs/pr-title-filter.server'
import { median as calcMedian } from '~/app/libs/stats'
import { orgContext, teamContext } from '~/app/middleware/context'
import { HiddenPrsMenu } from '~/app/routes/$orgSlug/+components/hidden-prs-menu'
import { StatCard } from '../+components/stat-card'
import { createColumns } from './+columns'
import {
  countOngoingPullRequests,
  getOngoingPullRequestReport,
} from './+functions/queries.server'
import type { Route } from './+types/index'

export const handle = {
  breadcrumb: () => ({
    label: 'Ongoing',
  }),
}

export type PullRequest = Awaited<
  ReturnType<typeof getOngoingPullRequestReport>
>[0]

export const loader = async ({ context, url }: Route.LoaderArgs) => {
  const { organization, membership } = context.get(orgContext)

  const teamParam = context.get(teamContext)
  const businessDaysOnly = url.searchParams.get('businessDays') !== '0'

  const toIso = dayjs().utc().toISOString()
  const filter = await loadPrFilterState(url, organization.id)

  const [pullRequests, hiddenPrs] = await Promise.all([
    getOngoingPullRequestReport(
      organization.id,
      null,
      toIso,
      teamParam || undefined,
      businessDaysOnly,
      filter.normalizedPatterns,
      filter.prTypes,
    ),
    loadHiddenPrSummary(filter, (breakdown) =>
      countOngoingPullRequests(
        organization.id,
        null,
        toIso,
        teamParam || undefined,
        breakdown,
      ),
    ),
  ])

  const ages = pullRequests
    .map((pr) => pr.createAndNowDiff)
    .filter((v): v is number => v !== null)
  const median = calcMedian(ages)

  return {
    pullRequests,
    median,
    businessDaysOnly,
    hiddenPrs,
    isAdmin: isOrgAdmin(membership.role),
  }
}

export default function OngoingPage({
  loaderData: { pullRequests, median, businessDaysOnly, hiddenPrs, isAdmin },
  params: { orgSlug },
}: Route.ComponentProps) {
  const [, setSearchParams] = useSearchParams()
  const timezone = useTimezone()
  const columns = useMemo(
    () => createColumns(timezone, orgSlug, isAdmin),
    [timezone, orgSlug, isAdmin],
  )

  return (
    <Stack>
      <PageHeader>
        <PageHeaderHeading>
          <PageHeaderTitle>Ongoing</PageHeaderTitle>
          <PageHeaderDescription>
            Pull requests currently in progress.
          </PageHeaderDescription>
        </PageHeaderHeading>
        <PageHeaderActions>
          <HiddenPrsMenu summary={hiddenPrs} isAdmin={isAdmin} />
        </PageHeaderActions>
      </PageHeader>

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
      >
        <div className="grid grid-cols-2 gap-4">
          <StatCard value={pullRequests.length} label="Ongoing" />
          <StatCard
            value={median !== null ? `${median.toFixed(1)}d` : '–'}
            label="Median Age"
          />
        </div>
      </AppDataTable>
    </Stack>
  )
}
