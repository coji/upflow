/**
 * チャート用の集計ロジック（client/server 共用）
 * clientLoader で呼び出し、集計済みデータをチャートコンポーネントに渡す。
 */
import { getPRComplexity, type PRSizeLabel } from './classify'

// --- 共通ユーティリティ ---

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2
}

function formatHours(h: number): string {
  if (h < 1) return `${(h * 60).toFixed(0)}m`
  if (h < 24) return `${h.toFixed(1)}h`
  return `${(h / 24).toFixed(1)}d`
}

// --- B. WIP vs Review Time ---

export interface WipRawRow {
  author: string
  authorDisplayName: string | null
  number: number
  repositoryId: string
  title: string
  url: string
  repo: string
  reviewTime: number | null
  pullRequestCreatedAt: string
  mergedAt: string | null
  additions: number | null
  deletions: number | null
  complexity: string | null
  complexityReason: string | null
  riskAreas: string | null
  correctedComplexity: string | null
}

export interface WipGroup {
  label: string
  medianHours: number
  count: number
}

export interface WipAggregation {
  groups: WipGroup[]
  insight: string | null
}

function getWipLabel(wipCount: number): string {
  if (wipCount <= 1) return 'WIP 0-1'
  if (wipCount === 2) return 'WIP 2'
  if (wipCount === 3) return 'WIP 3'
  return 'WIP 4+'
}

export type PRKey = `${string}:${number}` // repositoryId:number

/**
 * author ごとに sweep line で WIP 数を計算する。O(n log n)。
 * 各PRの作成時点で、同じ author の未マージ PR が何件あったかを返す。
 */
export function computeWipCounts(data: WipRawRow[]): Map<PRKey, number> {
  const result = new Map<PRKey, number>()

  // author ごとにグループ化
  const byAuthor = new Map<string, WipRawRow[]>()
  for (const pr of data) {
    const group = byAuthor.get(pr.author)
    if (group) group.push(pr)
    else byAuthor.set(pr.author, [pr])
  }

  for (const prs of byAuthor.values()) {
    // イベント列を作る: [timestamp, +1 or -1, PRKey]
    // +1 = PR 作成（WIP 開始）、-1 = PR マージ（WIP 終了）
    const events: { time: string; delta: number; key: PRKey }[] = []
    for (const pr of prs) {
      const key: PRKey = `${pr.repositoryId}:${pr.number}`
      events.push({ time: pr.pullRequestCreatedAt, delta: +1, key })
      if (pr.mergedAt !== null) {
        events.push({ time: pr.mergedAt, delta: -1, key })
      }
    }

    // 時刻順にソート。同時刻なら +1（開始）を先に処理
    events.sort((a, b) => {
      const cmp = a.time < b.time ? -1 : a.time > b.time ? 1 : 0
      if (cmp !== 0) return cmp
      return a.delta === b.delta ? 0 : a.delta > b.delta ? -1 : 1
    })

    // sweep: 現在の WIP 数を追跡
    let currentWip = 0
    for (const ev of events) {
      if (ev.delta === +1) {
        // この PR の作成時点での WIP = 今のカウント（自分を除く）
        result.set(ev.key, currentWip)
        currentWip++
      } else {
        currentWip--
      }
    }
  }

  return result
}

export function aggregateWipCycle(
  data: WipRawRow[],
  wipCounts?: Map<PRKey, number>,
): WipAggregation {
  const counts = wipCounts ?? computeWipCounts(data)

  const reviewTimes: Record<string, number[]> = {
    'WIP 0-1': [],
    'WIP 2': [],
    'WIP 3': [],
    'WIP 4+': [],
  }

  for (const pr of data) {
    if (pr.reviewTime === null || pr.reviewTime <= 0) continue
    const key: PRKey = `${pr.repositoryId}:${pr.number}`
    const wipCount = counts.get(key) ?? 0
    const hours = pr.reviewTime * 24
    const label = getWipLabel(wipCount)
    reviewTimes[label].push(hours)
  }

  const groups: WipGroup[] = Object.entries(reviewTimes)
    .map(([label, times]) => ({
      label,
      medianHours: median(times) ?? 0,
      count: times.length,
    }))
    .filter((g) => g.count > 0)

  const lowMedian = median(reviewTimes['WIP 0-1'])
  const highTimes = [...reviewTimes['WIP 3'], ...reviewTimes['WIP 4+']]
  const highMedian = median(highTimes)

  let insight: string | null = null
  if (lowMedian && highMedian && lowMedian > 0) {
    const ratio = (highMedian / lowMedian).toFixed(1)
    insight = `WIP 0-1 の review time 中央値: ${formatHours(lowMedian)} → WIP 3+ : ${formatHours(highMedian)}（${ratio}倍）`
  }

  return { groups, insight }
}

/**
 * 各PRにWIPラベルを付与して返す（ドリルダウンフィルタ用）
 */
export function computeWipLabels(
  data: WipRawRow[],
  wipCounts?: Map<PRKey, number>,
): (WipRawRow & { wipLabel: string })[] {
  const counts = wipCounts ?? computeWipCounts(data)

  return data
    .filter((d) => d.reviewTime !== null && d.reviewTime > 0)
    .map((pr) => {
      const key: PRKey = `${pr.repositoryId}:${pr.number}`
      const wipCount = counts.get(key) ?? 0
      return { ...pr, wipLabel: getWipLabel(wipCount) }
    })
}

// --- A. Queue Trend (週次キュー長トレンド) ---

export interface QueueHistoryRawRow {
  requestedAt: string
  resolvedAt: string | null
  mergedAt: string | null
  closedAt: string | null
}

export interface WeeklyQueuePoint {
  weekLabel: string // 'MM/DD'
  maxQueue: number
  medianQueue: number
}

export interface QueueTrendAggregation {
  weeks: WeeklyQueuePoint[]
  insight: string | null
}

/**
 * ある日 D のキュー長を計算:
 * requestedAt <= D かつ (resolvedAt == null || resolvedAt > D) かつ (mergedAt == null || mergedAt > D)
 */
function computeQueueLengthForDay(
  rows: QueueHistoryRawRow[],
  day: string,
): number {
  return rows.filter((r) => {
    if (r.requestedAt > day) return false
    if (r.resolvedAt !== null && r.resolvedAt <= day) return false
    if (r.mergedAt !== null && r.mergedAt <= day) return false
    if (r.closedAt !== null && r.closedAt <= day) return false
    return true
  }).length
}

export function aggregateWeeklyQueueTrend(
  data: QueueHistoryRawRow[],
  sinceDate: string,
): QueueTrendAggregation {
  if (data.length === 0) {
    return { weeks: [], insight: null }
  }

  const since = new Date(sinceDate)
  const today = new Date()

  // 各週の月曜日を列挙（sinceDateから今日まで）
  const weekStarts: Date[] = []
  const cursor = new Date(since)
  // 月曜始まりに揃える
  const dayOfWeek = cursor.getDay()
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  cursor.setDate(cursor.getDate() + diffToMonday)

  while (cursor <= today) {
    weekStarts.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 7)
  }

  const weeks: WeeklyQueuePoint[] = weekStarts.map((weekStart) => {
    const dailyQueues: number[] = []
    for (let d = 0; d < 7; d++) {
      const day = new Date(weekStart)
      day.setDate(day.getDate() + d)
      if (day > today) break
      const dayStr = day.toISOString()
      dailyQueues.push(computeQueueLengthForDay(data, dayStr))
    }

    const maxQueue = Math.max(...dailyQueues)
    const medianQueue = median(dailyQueues) ?? 0

    const label = `${String(weekStart.getMonth() + 1).padStart(2, '0')}/${String(weekStart.getDate()).padStart(2, '0')}`

    return { weekLabel: label, maxQueue, medianQueue }
  })

  // Insight: 直近4週 vs その前の4週
  let insight: string | null = null
  if (weeks.length >= 8) {
    const recent4 = weeks.slice(-4)
    const prev4 = weeks.slice(-8, -4)
    const recentAvg =
      recent4.reduce((s, w) => s + w.medianQueue, 0) / recent4.length
    const prevAvg = prev4.reduce((s, w) => s + w.medianQueue, 0) / prev4.length
    if (prevAvg > 0 && recentAvg > prevAvg * 1.2) {
      insight = `直近4週のキュー中央値が前4週比 ${((recentAvg / prevAvg) * 100 - 100).toFixed(0)}% 増加。レビュワー追加を検討してください。`
    }
  }

  return { weeks, insight }
}

// --- C. PR Size Distribution ---

const SIZE_ORDER: PRSizeLabel[] = ['XS', 'S', 'M', 'L', 'XL', 'Unclassified']

export interface PRSizeRawRow {
  number: number
  title: string
  url: string
  repo: string
  author: string
  authorDisplayName: string | null
  additions: number | null
  deletions: number | null
  reviewTime: number | null
  complexity: string | null
  complexityReason: string | null
  riskAreas: string | null
  correctedComplexity: string | null
}

export interface SizeCountItem {
  size: PRSizeLabel
  count: number
}

export interface SizeTimeItem {
  size: PRSizeLabel
  medianHours: number
}

export interface PRSizeAggregation {
  countData: SizeCountItem[]
  timeData: SizeTimeItem[]
  insight: string | null
}

export function aggregatePRSize(data: PRSizeRawRow[]): PRSizeAggregation {
  const bySize: Record<PRSizeLabel, { count: number; reviewTimes: number[] }> =
    {
      XS: { count: 0, reviewTimes: [] },
      S: { count: 0, reviewTimes: [] },
      M: { count: 0, reviewTimes: [] },
      L: { count: 0, reviewTimes: [] },
      XL: { count: 0, reviewTimes: [] },
      Unclassified: { count: 0, reviewTimes: [] },
    }

  for (const pr of data) {
    const size = getPRComplexity(pr)
    bySize[size].count++
    if (pr.reviewTime !== null && pr.reviewTime > 0) {
      bySize[size].reviewTimes.push(pr.reviewTime * 24)
    }
  }

  const countData = SIZE_ORDER.map((size) => ({
    size,
    count: bySize[size].count,
  }))

  const timeData = SIZE_ORDER.map((size) => ({
    size,
    medianHours: median(bySize[size].reviewTimes) ?? 0,
  }))

  const total = data.length
  const xsS = bySize.XS.count + bySize.S.count
  const xsSPct = total > 0 ? ((xsS / total) * 100).toFixed(0) : '0'
  const xsSMedian = median([...bySize.XS.reviewTimes, ...bySize.S.reviewTimes])

  let insight: string | null = null
  if (total > 0 && xsSMedian !== null) {
    insight = `全PRの ${xsSPct}% が XS/S サイズ（${xsS}件）。review time 中央値 ${formatHours(xsSMedian)}。これらを自動マージすればレビュー負荷を大幅に削減可能。`
  }

  return { countData, timeData, insight }
}
