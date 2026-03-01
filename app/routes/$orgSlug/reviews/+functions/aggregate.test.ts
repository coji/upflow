import { describe, expect, test } from 'vitest'
import { aggregatePRSize, aggregateWipCycle } from './aggregate'

describe('aggregateWipCycle', () => {
  test('groups PRs by WIP count and computes medians', () => {
    const data = [
      {
        author: 'alice',
        number: 1,
        repositoryId: 'r1',
        reviewTime: 1,
        pullRequestCreatedAt: '2024-01-01T00:00:00Z',
        mergedAt: '2024-01-02T00:00:00Z',
      },
      {
        author: 'alice',
        number: 2,
        repositoryId: 'r1',
        reviewTime: 2,
        pullRequestCreatedAt: '2024-01-01T12:00:00Z',
        mergedAt: '2024-01-03T00:00:00Z',
      },
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
      {
        author: 'alice',
        number: 1,
        repositoryId: 'r1',
        reviewTime: null,
        pullRequestCreatedAt: '2024-01-01T00:00:00Z',
        mergedAt: '2024-01-02T00:00:00Z',
      },
      {
        author: 'alice',
        number: 2,
        repositoryId: 'r1',
        reviewTime: 0,
        pullRequestCreatedAt: '2024-01-01T00:00:00Z',
        mergedAt: '2024-01-02T00:00:00Z',
      },
    ]

    const result = aggregateWipCycle(data)
    expect(result.groups).toEqual([])
  })
})

describe('aggregatePRSize', () => {
  test('classifies and aggregates by size', () => {
    const data = [
      { additions: 5, deletions: 3, reviewTime: 0.5, complexity: null },
      { additions: 30, deletions: 10, reviewTime: 1, complexity: null },
      { additions: 100, deletions: 50, reviewTime: 2, complexity: null },
    ]

    const result = aggregatePRSize(data)
    expect(result.countData.find((d) => d.size === 'XS')?.count).toBe(1)
    expect(result.countData.find((d) => d.size === 'S')?.count).toBe(1)
    expect(result.countData.find((d) => d.size === 'M')?.count).toBe(1)
  })

  test('uses LLM complexity when available', () => {
    const data = [
      { additions: 5, deletions: 3, reviewTime: 1, complexity: 'L' },
    ]

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
      { additions: 5, deletions: 3, reviewTime: 0.5, complexity: null },
      { additions: 8, deletions: 2, reviewTime: 0.3, complexity: null },
      { additions: 200, deletions: 100, reviewTime: 3, complexity: null },
    ]

    const result = aggregatePRSize(data)
    expect(result.insight).not.toBeNull()
    expect(result.insight).toContain('XS/S')
  })
})
