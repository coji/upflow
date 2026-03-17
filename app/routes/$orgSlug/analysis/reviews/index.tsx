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
import dayjs from '~/app/libs/dayjs'
import { orgContext } from '~/app/middleware/context'
import { listTeams } from '~/app/routes/$orgSlug/settings/teams._index/queries.server'
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
  const { organization } = context.get(orgContext)

  const url = new URL(request.url)
  const teamParam = url.searchParams.get('team')
  const periodParam = url.searchParams.get('period')
  const VALID_PERIODS = [1, 3, 6, 12]
  const periodMonths =
    periodParam === 'all'
      ? 'all'
      : VALID_PERIODS.includes(Number(periodParam))
        ? Number(periodParam)
        : 3

  const sinceDate =
    periodMonths === 'all'
      ? '2000-01-01T00:00:00.000Z'
      : dayjs.utc().subtract(periodMonths, 'month').startOf('day').toISOString()

  const teams = await listTeams(organization.id)

  const cacheKey = `reviews:${teamParam ?? 'all'}:${periodMonths}`
  const FIVE_MINUTES = 5 * 60 * 1000

  const [queueHistoryRaw, wipCycleRaw, prSizesRaw] = await getOrgCachedData(
    organization.id,
    cacheKey,
    () =>
      Promise.all([
        getQueueHistoryRawData(organization.id, sinceDate, teamParam),
        getWipCycleRawData(organization.id, sinceDate, teamParam),
        getPRSizeDistribution(organization.id, sinceDate, teamParam),
      ]),
    FIVE_MINUTES,
  )

  return {
    teams,
    queueHistoryRaw,
    wipCycleRaw,
    prSizesRaw,
    sinceDate,
    periodMonths,
  }
}

export const clientLoader = async ({
  serverLoader,
}: Route.ClientLoaderArgs) => {
  const {
    teams,
    queueHistoryRaw,
    wipCycleRaw,
    prSizesRaw,
    sinceDate,
    periodMonths,
  } = await serverLoader()

  const wipCounts = computeWipCounts(wipCycleRaw)

  return {
    teams,
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
    teams,
    queueTrend,
    wipCycle,
    wipCycleLabeled,
    prSizes,
    prSizesRaw,
    periodMonths,
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
          <TeamFilter teams={teams} />
        </PageHeaderActions>
      </PageHeader>

      <div className="space-y-6">
        <QueueTrendChart data={queueTrend} />
        <WipCycleChart data={wipCycle} rawData={wipCycleLabeled} />
        <PRSizeChart data={prSizes} rawData={prSizesRaw} />
      </div>
    </Stack>
  )
}
