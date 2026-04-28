import { XIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import {
  PageHeader,
  PageHeaderActions,
  PageHeaderDescription,
  PageHeaderHeading,
  PageHeaderTitle,
} from '~/app/components/layout/page-header'
import { Button } from '~/app/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/app/components/ui/select'
import { Stack } from '~/app/components/ui/stack'
import { ToggleGroup, ToggleGroupItem } from '~/app/components/ui/toggle-group'
import { calcSinceDate } from '~/app/libs/date-utils'
import dayjs from '~/app/libs/dayjs'
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
import { PrTitleFilterStatus } from '~/app/routes/$orgSlug/+components/pr-title-filter-status'
import { getOrgCachedData } from '~/app/services/cache.server'
import { BottleneckMixCard } from './+components/bottleneck-mix-card'
import { ByAuthorTable } from './+components/by-author-table'
import { InsightsCard } from './+components/insights-card'
import { KpiCards } from './+components/kpi-cards'
import { LongestPrsTable } from './+components/longest-prs-table'
import { WeeklyTrendChart } from './+components/weekly-trend-chart'
import {
  computeAuthorRows,
  computeBottleneckMix,
  computeInsights,
  computeKpi,
  computeLongestPrs,
  computeWeeklyTrend,
  filterRowsByWeek,
  type MetricMode,
} from './+functions/aggregate'
import {
  countCycleTimePullRequests,
  getCycleTimeRawData,
  listCycleTimeRepositories,
} from './+functions/queries.server'
import type { Route } from './+types/index'

export const handle = {
  breadcrumb: () => ({ label: 'Cycle Time' }),
}

const PERIOD_OPTIONS = [
  { value: '1', label: '1 month' },
  { value: '3', label: '3 months' },
  { value: '6', label: '6 months' },
  { value: '12', label: '1 year' },
] as const

const PERIOD_LABEL: Record<number, string> = {
  1: '1 month',
  3: '3 months',
  6: '6 months',
  12: '1 year',
}

const VALID_PERIODS = [1, 3, 6, 12] as const

const VALID_METRICS: readonly MetricMode[] = ['median', 'average'] as const

export const loader = async ({ request, context }: Route.LoaderArgs) => {
  const { organization, membership } = context.get(orgContext)
  const timezone = context.get(timezoneContext)
  const teamParam = context.get(teamContext)

  const url = new URL(request.url)

  const periodParam = url.searchParams.get('period')
  const periodMonths = VALID_PERIODS.includes(
    Number(periodParam) as (typeof VALID_PERIODS)[number],
  )
    ? Number(periodParam)
    : 3

  const metricParam = url.searchParams.get('metric')
  const metricMode: MetricMode = VALID_METRICS.includes(
    metricParam as MetricMode,
  )
    ? (metricParam as MetricMode)
    : 'median'

  const repositoryParamRaw = url.searchParams.get('repository')
  const repositoryParam =
    repositoryParamRaw && repositoryParamRaw.length > 0
      ? repositoryParamRaw
      : null

  const sinceDate = calcSinceDate(periodMonths, timezone)
  const prevSinceDate = calcSinceDate(periodMonths * 2, timezone)
  const now = dayjs.utc().toISOString()

  const filter = await loadPrFilterState(request, organization.id)

  const repositories = await listCycleTimeRepositories(
    organization.id,
    teamParam,
  )

  // Validate repository param against the team-scoped list
  const repositoryId = repositories.some((r) => r.id === repositoryParam)
    ? repositoryParam
    : null

  const sf = filter.showFiltered ? 't' : 'f'
  // Pattern signature must invalidate the cache when patterns change so users
  // don't see stale rows for ~5 min after editing the filter list.
  const patternSignature =
    filter.normalizedPatterns.length === 0
      ? 'none'
      : [...filter.normalizedPatterns].sort().join('|')
  // metricMode is intentionally NOT in the cache key — raw rows are mode-
  // agnostic, the median/average choice is applied in clientLoader.
  const cacheKey = `cycle-time:${teamParam ?? 'all'}:${repositoryId ?? 'all'}:${periodMonths}:sf=${sf}:patterns=${patternSignature}`
  const FIVE_MINUTES = 5 * 60 * 1000

  const [[currentRows, previousRows], excludedCount] = await Promise.all([
    getOrgCachedData(
      organization.id,
      cacheKey,
      () =>
        Promise.all([
          getCycleTimeRawData(
            organization.id,
            sinceDate,
            null,
            teamParam,
            repositoryId,
            filter.normalizedPatterns,
          ),
          getCycleTimeRawData(
            organization.id,
            prevSinceDate,
            sinceDate,
            teamParam,
            repositoryId,
            filter.normalizedPatterns,
          ),
        ]),
      FIVE_MINUTES,
    ),
    computeExcludedCount(filter, (patterns) =>
      countCycleTimePullRequests(
        organization.id,
        sinceDate,
        teamParam,
        repositoryId,
        patterns,
      ),
    ),
  ])

  return {
    currentRows,
    previousRows,
    sinceDate,
    untilDate: now,
    timezone,
    periodMonths,
    metricMode,
    repositoryId,
    repositories,
    excludedCount,
    filterActive: filter.filterActive,
    showFiltered: filter.showFiltered,
    hasAnyEnabledPattern: filter.hasAnyEnabledPattern,
    isAdmin: isOrgAdmin(membership.role),
  }
}

export const clientLoader = async ({
  serverLoader,
}: Route.ClientLoaderArgs) => {
  const data = await serverLoader()

  const weekly = computeWeeklyTrend(
    data.currentRows,
    data.sinceDate,
    data.untilDate,
    data.timezone,
    data.metricMode,
  )

  const kpi = computeKpi(data.currentRows, data.previousRows, data.metricMode)
  const mix = computeBottleneckMix(data.currentRows, data.metricMode)
  const prevMix = computeBottleneckMix(data.previousRows, data.metricMode)
  const insights = computeInsights({
    current: data.currentRows,
    previous: data.previousRows,
    weekly,
    mix,
    prevMix,
    mode: data.metricMode,
  })
  const authors = computeAuthorRows(
    data.currentRows,
    data.previousRows,
    data.metricMode,
  )
  const longest = computeLongestPrs(data.currentRows, 10)

  return {
    currentRows: data.currentRows,
    timezone: data.timezone,
    kpi,
    weekly,
    mix,
    insights,
    authors,
    longest,
    periodMonths: data.periodMonths,
    metricMode: data.metricMode,
    repositoryId: data.repositoryId,
    repositories: data.repositories,
    excludedCount: data.excludedCount,
    filterActive: data.filterActive,
    showFiltered: data.showFiltered,
    hasAnyEnabledPattern: data.hasAnyEnabledPattern,
    isAdmin: data.isAdmin,
  }
}
clientLoader.hydrate = true as const

export function HydrateFallback() {
  return (
    <Stack>
      <PageHeader>
        <PageHeaderHeading>
          <PageHeaderTitle>Cycle Time</PageHeaderTitle>
          <PageHeaderDescription>Loading…</PageHeaderDescription>
        </PageHeaderHeading>
      </PageHeader>
    </Stack>
  )
}

export default function CycleTimePage({
  loaderData: {
    currentRows,
    timezone,
    kpi,
    weekly,
    mix,
    insights,
    authors,
    longest,
    periodMonths,
    metricMode,
    repositoryId,
    repositories,
    excludedCount,
    filterActive,
    showFiltered,
    hasAnyEnabledPattern,
    isAdmin,
  },
}: Route.ComponentProps) {
  const [, setSearchParams] = useSearchParams()
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null)

  const periodLabel = PERIOD_LABEL[periodMonths] ?? `${periodMonths} months`

  // Reset selection if the underlying period no longer contains it (e.g. user
  // changed period / filters and the selected week disappeared).
  const selectedWeekValid =
    selectedWeek !== null && weekly.some((w) => w.weekStart === selectedWeek)
  const effectiveSelectedWeek = selectedWeekValid ? selectedWeek : null

  const weekDrilldown = useMemo(() => {
    if (effectiveSelectedWeek === null) return null
    const weekRows = filterRowsByWeek(
      currentRows,
      effectiveSelectedWeek,
      timezone,
    )
    // No previous-period rows: the "same week" of the prior period isn't a
    // meaningful comparison axis when drilling into a single week, so the
    // vs-prev column is intentionally blank during drill-down.
    return {
      mix: computeBottleneckMix(weekRows, metricMode),
      authors: computeAuthorRows(weekRows, [], metricMode),
      longest: computeLongestPrs(weekRows, 10),
      prCount: weekRows.length,
    }
  }, [effectiveSelectedWeek, currentRows, timezone, metricMode])

  const drilldown = weekDrilldown ?? {
    mix,
    authors,
    longest,
    prCount: kpi.prCount,
  }

  const selectedWeekPoint = effectiveSelectedWeek
    ? weekly.find((w) => w.weekStart === effectiveSelectedWeek)
    : null

  return (
    <Stack gap="6">
      <PageHeader>
        <PageHeaderHeading>
          <PageHeaderTitle>Cycle Time</PageHeaderTitle>
          <PageHeaderDescription>
            {periodLabel} trend of PR delivery speed and bottlenecks.
          </PageHeaderDescription>
        </PageHeaderHeading>
        <PageHeaderActions className="flex flex-wrap">
          <PrTitleFilterStatus
            excludedCount={excludedCount}
            filterActive={filterActive}
            showFiltered={showFiltered}
            hasAnyEnabledPattern={hasAnyEnabledPattern}
            isAdmin={isAdmin}
          />
          <Select
            value={repositoryId ?? 'all'}
            onValueChange={(value) => {
              setSearchParams((prev) => {
                if (value === 'all') {
                  prev.delete('repository')
                } else {
                  prev.set('repository', value)
                }
                return prev
              })
            }}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All repositories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All repositories</SelectItem>
              {repositories.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.owner}/{r.repo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={String(periodMonths)}
            onValueChange={(value) => {
              setSearchParams((prev) => {
                if (value === '3') {
                  prev.delete('period')
                } else {
                  prev.set('period', value)
                }
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
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={metricMode}
            onValueChange={(value) => {
              if (!value) return
              setSearchParams((prev) => {
                if (value === 'median') {
                  prev.delete('metric')
                } else {
                  prev.set('metric', value)
                }
                return prev
              })
            }}
          >
            <ToggleGroupItem value="median">Median</ToggleGroupItem>
            <ToggleGroupItem value="average">Average</ToggleGroupItem>
          </ToggleGroup>
        </PageHeaderActions>
      </PageHeader>

      <KpiCards kpi={kpi} mode={metricMode} periodLabel={periodLabel} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <WeeklyTrendChart
            weeks={weekly}
            mode={metricMode}
            selectedWeek={effectiveSelectedWeek}
            onSelectWeek={setSelectedWeek}
          />
        </div>
        <div className="space-y-4">
          <BottleneckMixCard mix={drilldown.mix} mode={metricMode} />
          <InsightsCard insights={insights} />
        </div>
      </div>

      {selectedWeekPoint && (
        <DrilldownBanner
          weekLabel={selectedWeekPoint.weekLabel}
          prCount={drilldown.prCount}
          onClear={() => setSelectedWeek(null)}
        />
      )}

      <ByAuthorTable rows={drilldown.authors} mode={metricMode} />
      <LongestPrsTable rows={drilldown.longest} />
    </Stack>
  )
}

function DrilldownBanner({
  weekLabel,
  prCount,
  onClear,
}: {
  weekLabel: string
  prCount: number
  onClear: () => void
}) {
  return (
    <div className="bg-muted/50 flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
      <span>
        Drilled down to week of <span className="font-medium">{weekLabel}</span>{' '}
        ·{' '}
        <span className="tabular-nums">
          {prCount} PR{prCount === 1 ? '' : 's'}
        </span>
        . Bottleneck Mix and tables below reflect this week only.
      </span>
      <Button variant="ghost" size="sm" onClick={onClear} className="h-7">
        <XIcon className="size-4" />
        Clear
      </Button>
    </div>
  )
}
