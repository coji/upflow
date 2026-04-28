import { startOfWeekMonday } from '~/app/libs/date-utils'
import dayjs from '~/app/libs/dayjs'
import { average, median, percentile } from '~/app/libs/stats'

export type MetricMode = 'median' | 'average'

export type CycleStage = 'coding' | 'pickup' | 'review' | 'deploy'

export const STAGES: readonly CycleStage[] = [
  'coding',
  'pickup',
  'review',
  'deploy',
] as const

export interface CycleTimeRawRow {
  repositoryId: string
  repo: string
  number: number
  title: string
  url: string
  author: string
  authorDisplayName: string | null
  state: 'open' | 'closed' | 'merged'
  pullRequestCreatedAt: string
  mergedAt: string | null
  releasedAt: string | null
  codingTime: number | null
  pickupTime: number | null
  reviewTime: number | null
  deployTime: number | null
  totalTime: number | null
}

// --- helpers ---

/**
 * Filter raw rows to those released within the week starting at `weekStart`
 * (Monday) in the given timezone. `weekStart` is the `YYYY-MM-DD` key produced
 * by `computeWeeklyTrend`.
 */
export function filterRowsByWeek(
  rows: CycleTimeRawRow[],
  weekStart: string,
  timezone: string,
): CycleTimeRawRow[] {
  return rows.filter((row) => {
    if (row.releasedAt === null) return false
    const wk = startOfWeekMonday(dayjs.utc(row.releasedAt).tz(timezone))
    return wk.format('YYYY-MM-DD') === weekStart
  })
}

function aggregateValue(values: number[], mode: MetricMode): number | null {
  return mode === 'median' ? median(values) : average(values)
}

type StageValues = Record<CycleStage, number[]>

const STAGE_KEY: Record<
  CycleStage,
  'codingTime' | 'pickupTime' | 'reviewTime' | 'deployTime'
> = {
  coding: 'codingTime',
  pickup: 'pickupTime',
  review: 'reviewTime',
  deploy: 'deployTime',
}

/**
 * Single O(n) pass that splits rows into the four stage value arrays. Used
 * by every aggregator so we don't scan rows once per stage.
 */
function partitionStageValues(rows: CycleTimeRawRow[]): StageValues {
  const out: StageValues = { coding: [], pickup: [], review: [], deploy: [] }
  for (const r of rows) {
    if (r.codingTime !== null) out.coding.push(r.codingTime)
    if (r.pickupTime !== null) out.pickup.push(r.pickupTime)
    if (r.reviewTime !== null) out.review.push(r.reviewTime)
    if (r.deployTime !== null) out.deploy.push(r.deployTime)
  }
  return out
}

function aggregateStages(
  buckets: StageValues,
  mode: MetricMode,
): Record<CycleStage, number | null> {
  return {
    coding: aggregateValue(buckets.coding, mode),
    pickup: aggregateValue(buckets.pickup, mode),
    review: aggregateValue(buckets.review, mode),
    deploy: aggregateValue(buckets.deploy, mode),
  }
}

function nonNullTotalValues(rows: CycleTimeRawRow[]): number[] {
  const out: number[] = []
  for (const r of rows) if (r.totalTime !== null) out.push(r.totalTime)
  return out
}

function bottleneckStage(row: CycleTimeRawRow): CycleStage | null {
  let best: CycleStage | null = null
  let bestVal = -Infinity
  for (const s of STAGES) {
    const v = row[STAGE_KEY[s]]
    if (v === null) continue
    if (v > bestVal) {
      bestVal = v
      best = s
    }
  }
  return best
}

// --- KPI ---

export interface CycleTimeDelta {
  /** Current value - previous value. null if either side is null. */
  diff: number | null
  /** Relative change (current/previous - 1). null if previous is null/0. */
  pct: number | null
}

export interface CycleTimeKpi {
  total: number | null
  prCount: number
  review: number | null
  deploy: number | null
  prevTotal: number | null
  prevPrCount: number
  prevReview: number | null
  prevDeploy: number | null
  totalDelta: CycleTimeDelta
  prCountDelta: CycleTimeDelta
  reviewDelta: CycleTimeDelta
  deployDelta: CycleTimeDelta
}

function makeDelta(
  current: number | null,
  prev: number | null,
): CycleTimeDelta {
  if (current === null || prev === null) return { diff: null, pct: null }
  const diff = current - prev
  const pct = prev === 0 ? null : current / prev - 1
  return { diff, pct }
}

export function computeKpi(
  rows: CycleTimeRawRow[],
  prevRows: CycleTimeRawRow[],
  mode: MetricMode,
): CycleTimeKpi {
  const cur = aggregateStages(partitionStageValues(rows), mode)
  const prev = aggregateStages(partitionStageValues(prevRows), mode)
  const total = aggregateValue(nonNullTotalValues(rows), mode)
  const prevTotal = aggregateValue(nonNullTotalValues(prevRows), mode)

  return {
    total,
    prCount: rows.length,
    review: cur.review,
    deploy: cur.deploy,
    prevTotal,
    prevPrCount: prevRows.length,
    prevReview: prev.review,
    prevDeploy: prev.deploy,
    totalDelta: makeDelta(total, prevTotal),
    prCountDelta: makeDelta(rows.length, prevRows.length),
    reviewDelta: makeDelta(cur.review, prev.review),
    deployDelta: makeDelta(cur.deploy, prev.deploy),
  }
}

// --- Weekly trend ---

export interface WeeklyTrendPoint {
  weekStart: string
  weekLabel: string
  prCount: number
  coding: number | null
  pickup: number | null
  review: number | null
  deploy: number | null
  total: number | null
}

export function computeWeeklyTrend(
  rows: CycleTimeRawRow[],
  sinceDate: string,
  untilDate: string,
  timezone: string,
  mode: MetricMode,
): WeeklyTrendPoint[] {
  const since = dayjs.utc(sinceDate).tz(timezone)
  const until = dayjs.utc(untilDate).tz(timezone)
  if (!since.isBefore(until)) return []

  const firstMonday = startOfWeekMonday(since)
  // until is exclusive — the last full day in range is until - 1ms
  const lastMonday = startOfWeekMonday(until.subtract(1, 'millisecond'))

  const weekKeys: string[] = []
  const buckets = new Map<string, CycleTimeRawRow[]>()
  let cursor = firstMonday
  while (cursor.isBefore(lastMonday) || cursor.isSame(lastMonday, 'day')) {
    const key = cursor.format('YYYY-MM-DD')
    weekKeys.push(key)
    buckets.set(key, [])
    cursor = cursor.add(7, 'day')
  }

  for (const row of rows) {
    if (row.releasedAt === null) continue
    const wk = startOfWeekMonday(dayjs.utc(row.releasedAt).tz(timezone))
    const key = wk.format('YYYY-MM-DD')
    const bucket = buckets.get(key)
    if (bucket) bucket.push(row)
  }

  return weekKeys.map((key) => {
    const bucket = buckets.get(key) ?? []
    const stages = aggregateStages(partitionStageValues(bucket), mode)
    const stageVals = [
      stages.coding,
      stages.pickup,
      stages.review,
      stages.deploy,
    ]
    // Total = sum of stage aggregates so the line matches the stacked bar
    // height and tooltip components in both median and average modes. (Median
    // of totalTime ≠ sum of stage medians, which previously caused the line
    // to disagree with the breakdown.)
    const total = stageVals.every((v) => v === null)
      ? null
      : stageVals.reduce<number>((s, v) => s + (v ?? 0), 0)
    return {
      weekStart: key,
      weekLabel: dayjs(key).format('MMM D'),
      prCount: bucket.length,
      ...stages,
      total,
    }
  })
}

// --- Bottleneck mix ---

export interface BottleneckMixSlice {
  stage: CycleStage
  value: number
  ratio: number
}

export interface BottleneckMix {
  /** Stage value (median/avg days) and share of the sum across stages. */
  slices: BottleneckMixSlice[]
  /** Sum of stage values. 0 when no data. */
  sum: number
}

export function computeBottleneckMix(
  rows: CycleTimeRawRow[],
  mode: MetricMode,
): BottleneckMix {
  const stages = aggregateStages(partitionStageValues(rows), mode)
  const values = STAGES.map((stage) => ({
    stage,
    value: stages[stage] ?? 0,
  }))
  const sum = values.reduce((s, v) => s + v.value, 0)
  return {
    slices: values.map(({ stage, value }) => ({
      stage,
      value,
      ratio: sum > 0 ? value / sum : 0,
    })),
    sum,
  }
}

// --- Insights ---

const DOMINANT_THRESHOLD = 0.3
const STAGE_IMPROVEMENT_THRESHOLD = 0.85
const DEPLOY_VARIANCE_RATIO = 2

const STAGE_LABEL_NICE: Record<CycleStage, string> = {
  coding: 'Coding',
  pickup: 'Pickup',
  review: 'Review',
  deploy: 'Deploy',
}

/**
 * Insight-friendly duration formatter. Sub-day values fall back to hours or
 * minutes so a 0.05-day delta reads as "1.2h" instead of the misleading
 * "0.0d", and stage values stay comparable across coding / pickup / review.
 */
function formatDays(d: number): string {
  if (d === 0) return '0d'
  const abs = Math.abs(d)
  if (abs >= 1) return `${d.toFixed(1)}d`
  const hours = d * 24
  if (Math.abs(hours) >= 1) return `${hours.toFixed(1)}h`
  return `${Math.round(d * 24 * 60)}m`
}

function formatPct(p: number): string {
  const sign = p >= 0 ? '+' : ''
  return `${sign}${(p * 100).toFixed(0)}%`
}

function directionVsPrev(
  current: number,
  prev: number | null,
): 'up' | 'down' | 'steady' {
  if (prev === null) return 'steady'
  if (current < prev) return 'down'
  if (current > prev) return 'up'
  return 'steady'
}

export function computeInsights(args: {
  current: CycleTimeRawRow[]
  previous: CycleTimeRawRow[]
  weekly: WeeklyTrendPoint[]
  mix: BottleneckMix
  prevMix: BottleneckMix
  mode: MetricMode
}): string[] {
  const { current, previous, weekly, mix, prevMix, mode } = args
  const insights: string[] = []

  if (current.length === 0) return insights

  const curStages = aggregateStages(partitionStageValues(current), mode)
  const prevStages = aggregateStages(partitionStageValues(previous), mode)

  const ranked = [...mix.slices].sort((a, b) => b.ratio - a.ratio)
  const dominant = ranked[0]

  // 1. Main driver — whichever stage actually has the largest share.
  if (dominant && dominant.ratio >= DOMINANT_THRESHOLD) {
    const stageLabel = STAGE_LABEL_NICE[dominant.stage]
    const pctText = `${(dominant.ratio * 100).toFixed(0)}%`
    const cur = curStages[dominant.stage]
    const prv = prevStages[dominant.stage]
    if (cur !== null && prv !== null && prv > 0) {
      const diff = cur - prv
      const pctDelta = cur / prv - 1
      if (diff > 0) {
        insights.push(
          `${stageLabel} time is the main driver (${pctText}). It increased ${formatDays(diff)} (${formatPct(pctDelta)}) vs previous period.`,
        )
      } else if (diff < 0) {
        insights.push(
          `${stageLabel} time is the main driver (${pctText}). It decreased ${formatDays(Math.abs(diff))} (${formatPct(pctDelta)}) but still leads cycle time.`,
        )
      } else {
        insights.push(
          `${stageLabel} time is the main driver (${pctText}) of cycle time in this period.`,
        )
      }
    } else {
      insights.push(
        `${stageLabel} time is the main driver (${pctText}) of cycle time in this period.`,
      )
    }
  }

  // 2. Notable improvement on a non-dominant stage (>=15% drop vs prev).
  for (const stage of STAGES) {
    if (dominant && stage === dominant.stage) continue
    const cur = curStages[stage]
    const prv = prevStages[stage]
    if (cur === null || prv === null || prv <= 0) continue
    if (cur < prv * STAGE_IMPROVEMENT_THRESHOLD) {
      const pctDelta = cur / prv - 1
      const stageLabel = STAGE_LABEL_NICE[stage]
      insights.push(
        `${stageLabel} time improved to ${formatDays(cur)} (${formatPct(pctDelta)}) vs previous period.`,
      )
      break
    }
  }

  // 3. Deploy variance across the period (skip when deploy is dominant —
  // the level message above already covers it).
  if (!dominant || dominant.stage !== 'deploy') {
    const deployValues = weekly
      .map((w) => w.deploy)
      .filter((v): v is number => v !== null && v > 0)
    if (deployValues.length >= 3) {
      const sortedDeploy = [...deployValues].sort((a, b) => a - b)
      const med = sortedDeploy[Math.floor(sortedDeploy.length / 2)]
      const max = sortedDeploy[sortedDeploy.length - 1]
      if (med > 0 && max >= med * DEPLOY_VARIANCE_RATIO) {
        insights.push(
          `Deploy time variance is high. Some weeks exceed ${formatDays(max)}.`,
        )
      }
    }
  }

  // 4. Fallback: dominant stage exists but didn't reach the threshold (no
  // previous data, or below 30%). Report direction vs prev so the panel
  // isn't empty.
  if (insights.length === 0 && dominant && dominant.ratio > 0) {
    const prevSlice = prevMix.slices.find((s) => s.stage === dominant.stage)
    const direction = directionVsPrev(dominant.value, prevSlice?.value ?? null)
    insights.push(
      `${STAGE_LABEL_NICE[dominant.stage]} accounts for ${(dominant.ratio * 100).toFixed(0)}% of cycle time and is ${direction} vs previous period.`,
    )
  }

  return insights.slice(0, 3)
}

// --- By Author ---

export interface AuthorRow {
  author: string
  displayName: string
  prCount: number
  composition: { stage: CycleStage; ratio: number }[]
  total: number | null
  mainDriver: CycleStage | null
  reviewP75: number | null
  changeVsPrev: CycleTimeDelta
}

function authorDisplay(row: CycleTimeRawRow): string {
  return row.authorDisplayName?.trim() || row.author
}

export function computeAuthorRows(
  rows: CycleTimeRawRow[],
  prevRows: CycleTimeRawRow[],
  mode: MetricMode,
): AuthorRow[] {
  const groupCurrent = new Map<string, CycleTimeRawRow[]>()
  for (const r of rows) {
    const key = r.author
    const list = groupCurrent.get(key)
    if (list) list.push(r)
    else groupCurrent.set(key, [r])
  }

  const groupPrev = new Map<string, CycleTimeRawRow[]>()
  for (const r of prevRows) {
    const key = r.author
    const list = groupPrev.get(key)
    if (list) list.push(r)
    else groupPrev.set(key, [r])
  }

  const out: AuthorRow[] = []
  for (const [author, authorRows] of groupCurrent) {
    const buckets = partitionStageValues(authorRows)
    const stageValues = STAGES.map((stage) => ({
      stage,
      value: aggregateValue(buckets[stage], mode) ?? 0,
    }))
    const sum = stageValues.reduce((s, v) => s + v.value, 0)

    let mainDriver: CycleStage | null = null
    let mainDriverValue = -Infinity
    const composition: AuthorRow['composition'] = []
    for (const sv of stageValues) {
      composition.push({
        stage: sv.stage,
        ratio: sum > 0 ? sv.value / sum : 0,
      })
      if (sv.value > 0 && sv.value > mainDriverValue) {
        mainDriverValue = sv.value
        mainDriver = sv.stage
      }
    }

    const total = aggregateValue(nonNullTotalValues(authorRows), mode)
    const reviewP75 = percentile(buckets.review, 0.75)

    const prevList = groupPrev.get(author) ?? []
    const prevTotal = aggregateValue(nonNullTotalValues(prevList), mode)

    out.push({
      author,
      displayName: authorDisplay(authorRows[0]),
      prCount: authorRows.length,
      composition,
      total,
      mainDriver,
      reviewP75,
      changeVsPrev: makeDelta(total, prevTotal),
    })
  }

  out.sort((a, b) => {
    if (b.prCount !== a.prCount) return b.prCount - a.prCount
    return a.displayName.localeCompare(b.displayName)
  })

  return out
}

// --- Longest PRs ---

export interface LongestPrRow {
  repositoryId: string
  repo: string
  number: number
  title: string
  url: string
  author: string
  authorDisplayName: string | null
  state: 'open' | 'closed' | 'merged'
  totalTime: number
  codingTime: number | null
  pickupTime: number | null
  reviewTime: number | null
  deployTime: number | null
  bottleneck: CycleStage | null
  updatedAt: string
}

export function computeLongestPrs(
  rows: CycleTimeRawRow[],
  limit = 10,
): LongestPrRow[] {
  const filtered = rows.filter(
    (r): r is CycleTimeRawRow & { totalTime: number; releasedAt: string } =>
      r.totalTime !== null && r.releasedAt !== null,
  )
  filtered.sort((a, b) => b.totalTime - a.totalTime)
  return filtered.slice(0, limit).map((r) => ({
    repositoryId: r.repositoryId,
    repo: r.repo,
    number: r.number,
    title: r.title,
    url: r.url,
    author: r.author,
    authorDisplayName: r.authorDisplayName,
    state: r.state,
    totalTime: r.totalTime,
    codingTime: r.codingTime,
    pickupTime: r.pickupTime,
    reviewTime: r.reviewTime,
    deployTime: r.deployTime,
    bottleneck: bottleneckStage(r),
    updatedAt: r.releasedAt,
  }))
}
