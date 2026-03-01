import { describe, expect, test } from 'vitest'
import {
  aggregatePRSize,
  aggregateWipCycle,
  computeWipLabels,
} from './aggregate'

const wipRow = (
  overrides: Partial<{
    author: string
    number: number
    repositoryId: string
    title: string
    url: string
    repo: string
    reviewTime: number | null
    pullRequestCreatedAt: string
    mergedAt: string | null
  }>,
) => ({
  author: 'alice',
  number: 1,
  repositoryId: 'r1',
  title: 'test PR',
  url: 'https://github.com/org/repo/pull/1',
  repo: 'repo',
  reviewTime: 1 as number | null,
  pullRequestCreatedAt: '2024-01-01T00:00:00Z',
  mergedAt: '2024-01-02T00:00:00Z' as string | null,
  ...overrides,
})

const sizeRow = (
  overrides: Partial<{
    number: number
    title: string
    url: string
    repo: string
    author: string
    additions: number | null
    deletions: number | null
    reviewTime: number | null
    complexity: string | null
  }>,
) => ({
  number: 1,
  title: 'test PR',
  url: 'https://github.com/org/repo/pull/1',
  repo: 'repo',
  author: 'alice',
  additions: 10 as number | null,
  deletions: 5 as number | null,
  reviewTime: 1 as number | null,
  complexity: null as string | null,
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

describe('aggregatePRSize', () => {
  test('classifies and aggregates by size', () => {
    const data = [
      sizeRow({ additions: 5, deletions: 3, reviewTime: 0.5 }),
      sizeRow({ number: 2, additions: 30, deletions: 10, reviewTime: 1 }),
      sizeRow({ number: 3, additions: 100, deletions: 50, reviewTime: 2 }),
    ]

    const result = aggregatePRSize(data)
    expect(result.countData.find((d) => d.size === 'XS')?.count).toBe(1)
    expect(result.countData.find((d) => d.size === 'S')?.count).toBe(1)
    expect(result.countData.find((d) => d.size === 'M')?.count).toBe(1)
  })

  test('uses LLM complexity when available', () => {
    const data = [sizeRow({ additions: 5, deletions: 3, complexity: 'L' })]

    const result = aggregatePRSize(data)
    expect(result.countData.find((d) => d.size === 'L')?.count).toBe(1)
    expect(result.countData.find((d) => d.size === 'XS')?.count).toBe(0)
  })

  test('returns zero counts for empty data', () => {
    const result = aggregatePRSize([])
    expect(result.countData.every((d) => d.count === 0)).toBe(true)
    expect(result.insight).toBeNull()
  })

  test('generates insight text when XS/S PRs exist', () => {
    const data = [
      sizeRow({ additions: 5, deletions: 3, reviewTime: 0.5 }),
      sizeRow({ number: 2, additions: 8, deletions: 2, reviewTime: 0.3 }),
      sizeRow({ number: 3, additions: 200, deletions: 100, reviewTime: 3 }),
    ]

    const result = aggregatePRSize(data)
    expect(result.insight).not.toBeNull()
    expect(result.insight).toContain('XS/S')
  })
})
