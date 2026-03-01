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

interface WipRawRow {
  author: string
  number: number
  repositoryId: string
  reviewTime: number | null
  pullRequestCreatedAt: string
  mergedAt: string | null
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

export function aggregateWipCycle(data: WipRawRow[]): WipAggregation {
  // PR作成時点でのauthorのWIP数を計算
  const prsWithWip = data
    .filter((d) => d.reviewTime !== null && d.reviewTime > 0)
    .map((pr) => {
      const wipCount = data.filter(
        (other) =>
          other.author === pr.author &&
          other.pullRequestCreatedAt <= pr.pullRequestCreatedAt &&
          (other.mergedAt === null ||
            other.mergedAt > pr.pullRequestCreatedAt) &&
          (other.number !== pr.number ||
            other.repositoryId !== pr.repositoryId),
      ).length
      return { wipCount, reviewTimeHours: (pr.reviewTime as number) * 24 }
    })

  const reviewTimes: Record<string, number[]> = {
    'WIP 0-1': [],
    'WIP 2': [],
    'WIP 3': [],
    'WIP 4+': [],
  }

  for (const d of prsWithWip) {
    if (d.wipCount <= 1) reviewTimes['WIP 0-1'].push(d.reviewTimeHours)
    else if (d.wipCount === 2) reviewTimes['WIP 2'].push(d.reviewTimeHours)
    else if (d.wipCount === 3) reviewTimes['WIP 3'].push(d.reviewTimeHours)
    else reviewTimes['WIP 4+'].push(d.reviewTimeHours)
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

// --- C. PR Size Distribution ---

const SIZE_ORDER: PRSizeLabel[] = ['XS', 'S', 'M', 'L', 'XL']

interface PRSizeRawRow {
  additions: number | null
  deletions: number | null
  reviewTime: number | null
  complexity: string | null
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
