import { useSearchParams } from 'react-router'
import {
  PageHeader,
  PageHeaderActions,
  PageHeaderDescription,
  PageHeaderHeading,
  PageHeaderTitle,
} from '~/app/components/layout/page-header'
import { TeamFilter } from '~/app/components/team-filter'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/app/components/ui/select'
import { Stack } from '~/app/components/ui/stack'
import { requireOrgMember } from '~/app/libs/auth.server'
import dayjs from '~/app/libs/dayjs'
import { listTeams } from '../settings/teams._index/queries.server'
import { PRSizeChart } from './+components/pr-size-chart'
import { ReviewerQueueChart } from './+components/reviewer-queue-chart'
import { WipCycleChart } from './+components/wip-cycle-chart'
import { aggregatePRSize, aggregateWipCycle } from './+functions/aggregate'
import {
  getPRSizeDistribution,
  getReviewerQueueDistribution,
  getWipCycleRawData,
} from './+functions/queries.server'
import type { Route } from './+types/index'

const PERIOD_OPTIONS = [
  { value: '1', label: '1 month' },
  { value: '3', label: '3 months' },
  { value: '6', label: '6 months' },
  { value: '12', label: '1 year' },
] as const

export const loader = async ({ request, params }: Route.LoaderArgs) => {
  const { organization } = await requireOrgMember(request, params.orgSlug)

  const url = new URL(request.url)
  const teamParam = url.searchParams.get('team')
  const periodMonths = Number(url.searchParams.get('period') || '3')

  const sinceDate = dayjs()
    .subtract(periodMonths, 'month')
    .startOf('day')
    .toISOString()

  const teams = await listTeams(organization.id)

  const [reviewerQueue, wipCycleRaw, prSizesRaw] = await Promise.all([
    getReviewerQueueDistribution(organization.id, teamParam),
    getWipCycleRawData(organization.id, sinceDate, teamParam),
    getPRSizeDistribution(organization.id, sinceDate, teamParam),
  ])

  return {
    teams,
    reviewerQueue,
    wipCycleRaw,
    prSizesRaw,
    periodMonths,
  }
}

export const clientLoader = async ({
  serverLoader,
}: Route.ClientLoaderArgs) => {
  const { teams, reviewerQueue, wipCycleRaw, prSizesRaw, periodMonths } =
    await serverLoader()

  return {
    teams,
    reviewerQueue,
    wipCycle: aggregateWipCycle(wipCycleRaw),
    prSizes: aggregatePRSize(prSizesRaw),
    periodMonths,
  }
}
clientLoader.hydrate = true as const

export function HydrateFallback() {
  return (
    <Stack gap="6">
      <PageHeader>
        <PageHeaderHeading>
          <PageHeaderTitle>Review Bottleneck</PageHeaderTitle>
          <PageHeaderDescription>Loading...</PageHeaderDescription>
        </PageHeaderHeading>
      </PageHeader>
    </Stack>
  )
}

export default function ReviewsPage({
  loaderData: { teams, reviewerQueue, wipCycle, prSizes, periodMonths },
}: Route.ComponentProps) {
  const [, setSearchParams] = useSearchParams()

  return (
    <Stack gap="6">
      <PageHeader>
        <PageHeaderHeading>
          <PageHeaderTitle>Review Bottleneck</PageHeaderTitle>
          <PageHeaderDescription>
            Visualize where PR reviews are getting stuck and why.
          </PageHeaderDescription>
        </PageHeaderHeading>
        <PageHeaderActions>
          <Select
            value={String(periodMonths)}
            onValueChange={(value) => {
              setSearchParams((prev) => {
                prev.set('period', value)
                return prev
              })
            }}
          >
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <TeamFilter teams={teams} />
        </PageHeaderActions>
      </PageHeader>

      <ReviewerQueueChart data={reviewerQueue} />
      <WipCycleChart data={wipCycle} />
      <PRSizeChart data={prSizes} />
    </Stack>
  )
}
