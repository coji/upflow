import { useSearchParams } from 'react-router'
import {
  PageHeader,
  PageHeaderActions,
  PageHeaderDescription,
  PageHeaderHeading,
  PageHeaderTitle,
} from '~/app/components/layout/page-header'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/app/components/ui/select'
import { Stack } from '~/app/components/ui/stack'
import { calcSinceDate } from '~/app/libs/date-utils'
import { isOrgAdmin } from '~/app/libs/member-role'
import {
  computeExcludedCount,
  loadPrFilterState,
} from '~/app/libs/pr-title-filter.server'
import {
  orgContext,
  teamContext,
  timezoneContext,
} from '~/app/middleware/context'
import { PrTitleFilterBanner } from '~/app/routes/$orgSlug/+components/pr-title-filter-banner'
import { getOrgCachedData } from '~/app/services/cache.server'
import { PRSizeChart } from './+components/pr-size-chart'
import { QueueTrendChart } from './+components/queue-trend-chart'
import { WipCycleChart } from './+components/wip-cycle-chart'
import {
  aggregatePRSize,
  aggregateWeeklyQueueTrend,
  aggregateWipCycle,
  computeWipCounts,
  computeWipLabels,
} from './+functions/aggregate'
import {
  countWipCyclePullRequests,
  getPRSizeDistribution,
  getQueueHistoryRawData,
  getWipCycleRawData,
} from './+functions/queries.server'
import type { Route } from './+types/index'

export const handle = {
  breadcrumb: () => ({ label: 'Review Bottleneck' }),
}

const PERIOD_OPTIONS = [
  { value: '1', label: '1 month' },
  { value: '3', label: '3 months' },
  { value: '6', label: '6 months' },
  { value: '12', label: '1 year' },
  { value: 'all', label: 'All time' },
] as const

export const loader = async ({ request, context }: Route.LoaderArgs) => {
  const { organization, membership } = context.get(orgContext)
  const timezone = context.get(timezoneContext)

  const url = new URL(request.url)
  const teamParam = context.get(teamContext)
  const periodParam = url.searchParams.get('period')
  const VALID_PERIODS = [1, 3, 6, 12]
  const periodMonths =
    periodParam === 'all'
      ? 'all'
      : VALID_PERIODS.includes(Number(periodParam))
        ? Number(periodParam)
        : 3

  const sinceDate = calcSinceDate(periodMonths, timezone)

  const filter = await loadPrFilterState(request, organization.id)

  const sf = filter.showFiltered ? 't' : 'f'
  const cacheKey = `reviews:${teamParam ?? 'all'}:${periodMonths}:sf=${sf}`
  const FIVE_MINUTES = 5 * 60 * 1000

  const [[queueHistoryRaw, wipCycleRaw, prSizesRaw], excludedCount] =
    await Promise.all([
      getOrgCachedData(
        organization.id,
        cacheKey,
        () =>
          Promise.all([
            getQueueHistoryRawData(
              organization.id,
              sinceDate,
              teamParam,
              filter.normalizedPatterns,
            ),
            getWipCycleRawData(
              organization.id,
              sinceDate,
              teamParam,
              filter.normalizedPatterns,
            ),
            getPRSizeDistribution(
              organization.id,
              sinceDate,
              teamParam,
              filter.normalizedPatterns,
            ),
          ]),
        FIVE_MINUTES,
      ),
      computeExcludedCount(filter, (patterns) =>
        countWipCyclePullRequests(
          organization.id,
          sinceDate,
          teamParam,
          patterns,
        ),
      ),
    ])

  return {
    queueHistoryRaw,
    wipCycleRaw,
    prSizesRaw,
    sinceDate,
    periodMonths,
    excludedCount,
    filterActive: filter.filterActive,
    showFiltered: filter.showFiltered,
    isAdmin: isOrgAdmin(membership.role),
  }
}

export const clientLoader = async ({
  serverLoader,
}: Route.ClientLoaderArgs) => {
  const {
    queueHistoryRaw,
    wipCycleRaw,
    prSizesRaw,
    sinceDate,
    periodMonths,
    excludedCount,
    filterActive,
    showFiltered,
    isAdmin,
  } = await serverLoader()

  const wipCounts = computeWipCounts(wipCycleRaw)

  return {
    queueTrend: aggregateWeeklyQueueTrend(
      queueHistoryRaw.filter(
        (r): r is typeof r & { requestedAt: string } => r.requestedAt !== null,
      ),
      sinceDate,
    ),
    wipCycle: aggregateWipCycle(wipCycleRaw, wipCounts),
    wipCycleLabeled: computeWipLabels(wipCycleRaw, wipCounts),
    prSizes: aggregatePRSize(prSizesRaw),
    prSizesRaw,
    periodMonths,
    excludedCount,
    filterActive,
    showFiltered,
    isAdmin,
  }
}
clientLoader.hydrate = true as const

export function HydrateFallback() {
  return (
    <Stack>
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
    queueTrend,
    wipCycle,
    wipCycleLabeled,
    prSizes,
    prSizesRaw,
    periodMonths,
    excludedCount,
    filterActive,
    showFiltered,
    isAdmin,
  },
}: Route.ComponentProps) {
  const [, setSearchParams] = useSearchParams()

  return (
    <Stack>
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
        </PageHeaderActions>
      </PageHeader>

      <PrTitleFilterBanner
        excludedCount={excludedCount}
        filterActive={filterActive}
        showFiltered={showFiltered}
        isAdmin={isAdmin}
      />

      <div className="space-y-6">
        <QueueTrendChart data={queueTrend} />
        <WipCycleChart data={wipCycle} rawData={wipCycleLabeled} />
        <PRSizeChart data={prSizes} rawData={prSizesRaw} />
      </div>
    </Stack>
  )
}
