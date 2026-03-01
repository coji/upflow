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
import { getCachedData } from '~/app/services/cache.server'
import { listTeams } from '../settings/teams._index/queries.server'
import { PRSizeChart } from './+components/pr-size-chart'
import { ReviewerQueueChart } from './+components/reviewer-queue-chart'
import { WipCycleChart } from './+components/wip-cycle-chart'
import {
  aggregatePRSize,
  aggregateWipCycle,
  computeWipLabels,
} from './+functions/aggregate'
import {
  getPRSizeDistribution,
  getReviewerQueueDistribution,
  getReviewerQueuePRs,
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
  const VALID_PERIODS = [1, 3, 6, 12]
  const periodMonths = VALID_PERIODS.includes(
    Number(url.searchParams.get('period')),
  )
    ? Number(url.searchParams.get('period'))
    : 3

  const sinceDate = dayjs()
    .subtract(periodMonths, 'month')
    .startOf('day')
    .toISOString()

  const teams = await listTeams(organization.id)

  const cacheKey = `reviews:${organization.id}:${teamParam ?? 'all'}:${periodMonths}`
  const FIVE_MINUTES = 5 * 60 * 1000

  const [reviewerQueue, reviewerQueueRawPRs, wipCycleRaw, prSizesRaw] =
    await getCachedData(
      cacheKey,
      () =>
        Promise.all([
          getReviewerQueueDistribution(organization.id, teamParam),
          getReviewerQueuePRs(organization.id, teamParam),
          getWipCycleRawData(organization.id, sinceDate, teamParam),
          getPRSizeDistribution(organization.id, sinceDate, teamParam),
        ]),
      FIVE_MINUTES,
    )

  return {
    teams,
    reviewerQueue,
    reviewerQueueRawPRs,
    wipCycleRaw,
    prSizesRaw,
    periodMonths,
  }
}

export const clientLoader = async ({
  serverLoader,
}: Route.ClientLoaderArgs) => {
  const {
    teams,
    reviewerQueue,
    reviewerQueueRawPRs,
    wipCycleRaw,
    prSizesRaw,
    periodMonths,
  } = await serverLoader()

  return {
    teams,
    reviewerQueue,
    reviewerQueueRawPRs,
    wipCycle: aggregateWipCycle(wipCycleRaw),
    wipCycleLabeled: computeWipLabels(wipCycleRaw),
    prSizes: aggregatePRSize(prSizesRaw),
    prSizesRaw,
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
  loaderData: {
    teams,
    reviewerQueue,
    reviewerQueueRawPRs,
    wipCycle,
    wipCycleLabeled,
    prSizes,
    prSizesRaw,
    periodMonths,
  },
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

      <ReviewerQueueChart data={reviewerQueue} rawPRs={reviewerQueueRawPRs} />
      <WipCycleChart data={wipCycle} rawData={wipCycleLabeled} />
      <PRSizeChart data={prSizes} rawData={prSizesRaw} />
    </Stack>
  )
}
