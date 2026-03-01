import { describe, expect, test } from 'vitest'
import {
  aggregatePRSize,
  aggregateWeeklyQueueTrend,
  aggregateWipCycle,
  computeWipLabels,
  type QueueHistoryRawRow,
} from './aggregate'

const wipRow = (
  overrides: Partial<{
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
  }>,
) => ({
  author: 'alice',
  authorDisplayName: null as string | null,
  number: 1,
  repositoryId: 'r1',
  title: 'test PR',
  url: 'https://github.com/org/repo/pull/1',
  repo: 'repo',
  reviewTime: 1 as number | null,
  pullRequestCreatedAt: '2024-01-01T00:00:00Z',
  mergedAt: '2024-01-02T00:00:00Z' as string | null,
  additions: 10 as number | null,
  deletions: 5 as number | null,
  complexity: null as string | null,
  complexityReason: null as string | null,
  riskAreas: null as string | null,
  ...overrides,
})

const sizeRow = (
  overrides: Partial<{
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
  }>,
) => ({
  number: 1,
  title: 'test PR',
  url: 'https://github.com/org/repo/pull/1',
  repo: 'repo',
  author: 'alice',
  authorDisplayName: null as string | null,
  additions: 10 as number | null,
  deletions: 5 as number | null,
  reviewTime: 1 as number | null,
  complexity: null as string | null,
  complexityReason: null as string | null,
  riskAreas: null as string | null,
  ...overrides,
})

describe('aggregateWipCycle', () => {
  test('groups PRs by WIP count and computes medians', () => {
    const data = [
      wipRow({ number: 1, reviewTime: 1 }),
      wipRow({
        number: 2,
        reviewTime: 2,
        pullRequestCreatedAt: '2024-01-01T12:00:00Z',
        mergedAt: '2024-01-03T00:00:00Z',
      }),
    ]

    const result = aggregateWipCycle(data)
    expect(result.groups.length).toBeGreaterThan(0)
    expect(result.groups.every((g) => g.count > 0)).toBe(true)
    expect(result.groups.every((g) => g.medianHours > 0)).toBe(true)
  })

  test('returns empty groups for empty data', () => {
    const result = aggregateWipCycle([])
    expect(result.groups).toEqual([])
    expect(result.insight).toBeNull()
  })

  test('skips PRs with null or zero reviewTime', () => {
    const data = [
      wipRow({ number: 1, reviewTime: null }),
      wipRow({ number: 2, reviewTime: 0 }),
    ]

    const result = aggregateWipCycle(data)
    expect(result.groups).toEqual([])
  })
})

describe('computeWipLabels', () => {
  test('assigns WIP labels based on concurrent PRs', () => {
    const data = [
      wipRow({
        number: 1,
        pullRequestCreatedAt: '2024-01-01T00:00:00Z',
        mergedAt: '2024-01-05T00:00:00Z',
      }),
      wipRow({
        number: 2,
        pullRequestCreatedAt: '2024-01-02T00:00:00Z',
        mergedAt: '2024-01-03T00:00:00Z',
      }),
    ]

    const result = computeWipLabels(data)
    expect(result.length).toBe(2)
    expect(result.every((r) => r.wipLabel)).toBe(true)
  })

  test('skips PRs with null reviewTime', () => {
    const data = [wipRow({ reviewTime: null })]
    const result = computeWipLabels(data)
    expect(result).toEqual([])
  })
})

const queueRow = (
  overrides: Partial<QueueHistoryRawRow> = {},
): QueueHistoryRawRow => ({
  requestedAt: '2024-01-15T00:00:00Z',
  resolvedAt: '2024-01-20T00:00:00Z',
  mergedAt: '2024-01-22T00:00:00Z',
  ...overrides,
})

describe('aggregateWeeklyQueueTrend', () => {
  test('returns empty weeks for empty data', () => {
    const result = aggregateWeeklyQueueTrend([], '2024-01-01T00:00:00.000Z')
    expect(result.weeks).toEqual([])
    expect(result.insight).toBeNull()
  })

  test('computes weekly max and median queue lengths', () => {
    // Create assignments that overlap: 3 pending on Jan 15-17, 1 resolves on Jan 16
    const data: QueueHistoryRawRow[] = [
      queueRow({
        requestedAt: '2024-01-15T00:00:00Z',
        resolvedAt: '2024-01-25T00:00:00Z',
        mergedAt: '2024-01-26T00:00:00Z',
      }),
      queueRow({
        requestedAt: '2024-01-15T00:00:00Z',
        resolvedAt: '2024-01-16T00:00:00Z',
        mergedAt: '2024-01-20T00:00:00Z',
      }),
      queueRow({
        requestedAt: '2024-01-17T00:00:00Z',
        resolvedAt: '2024-01-22T00:00:00Z',
        mergedAt: '2024-01-23T00:00:00Z',
      }),
    ]

    const result = aggregateWeeklyQueueTrend(data, '2024-01-14T00:00:00.000Z')
    expect(result.weeks.length).toBeGreaterThan(0)
    // At least one week should have max > 0
    expect(result.weeks.some((w) => w.maxQueue > 0)).toBe(true)
    // Median should be <= max for every week
    for (const w of result.weeks) {
      expect(w.medianQueue).toBeLessThanOrEqual(w.maxQueue)
    }
  })

  test('handles unresolved assignments (resolvedAt = null)', () => {
    const data: QueueHistoryRawRow[] = [
      queueRow({
        requestedAt: '2024-01-15T00:00:00Z',
        resolvedAt: null,
        mergedAt: null,
      }),
    ]

    const result = aggregateWeeklyQueueTrend(data, '2024-01-14T00:00:00.000Z')
    expect(result.weeks.length).toBeGreaterThan(0)
    // The unresolved item should contribute to queue on every day after requestedAt
    const weeksWithQueue = result.weeks.filter((w) => w.maxQueue > 0)
    expect(weeksWithQueue.length).toBeGreaterThan(0)
  })

  test('insight is null when fewer than 8 weeks', () => {
    const data: QueueHistoryRawRow[] = [
      queueRow({
        requestedAt: '2024-01-15T00:00:00Z',
        resolvedAt: '2024-01-20T00:00:00Z',
        mergedAt: '2024-01-22T00:00:00Z',
      }),
    ]
    const result = aggregateWeeklyQueueTrend(data, '2024-01-14T00:00:00.000Z')
    expect(result.insight).toBeNull()
  })
})

describe('aggregatePRSize', () => {
  test('classifies and aggregates by LLM complexity', () => {
    const data = [
      sizeRow({ complexity: 'XS', reviewTime: 0.5 }),
      sizeRow({ number: 2, complexity: 'S', reviewTime: 1 }),
      sizeRow({ number: 3, complexity: 'M', reviewTime: 2 }),
    ]

    const result = aggregatePRSize(data)
    expect(result.countData.find((d) => d.size === 'XS')?.count).toBe(1)
    expect(result.countData.find((d) => d.size === 'S')?.count).toBe(1)
    expect(result.countData.find((d) => d.size === 'M')?.count).toBe(1)
  })

  test('marks unclassified PRs when complexity is null', () => {
    const data = [sizeRow({ complexity: null })]

    const result = aggregatePRSize(data)
    expect(result.countData.find((d) => d.size === 'Unclassified')?.count).toBe(
      1,
    )
  })

  test('returns zero counts for empty data', () => {
    const result = aggregatePRSize([])
    expect(result.countData.every((d) => d.count === 0)).toBe(true)
    expect(result.insight).toBeNull()
  })

  test('generates insight text when XS/S PRs exist', () => {
    const data = [
      sizeRow({ complexity: 'XS', reviewTime: 0.5 }),
      sizeRow({ number: 2, complexity: 'S', reviewTime: 0.3 }),
      sizeRow({ number: 3, complexity: 'L', reviewTime: 3 }),
    ]

    const result = aggregatePRSize(data)
    expect(result.insight).not.toBeNull()
    expect(result.insight).toContain('XS/S')
  })
})
