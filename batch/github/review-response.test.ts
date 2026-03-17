import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import dayjs from '~/app/libs/dayjs'
import type { ShapedGitHubReviewComment } from './model'
import { analyzeReviewResponse } from './review-response'

const comment = (
  user: string,
  createdAt: string,
): ShapedGitHubReviewComment => ({
  id: 1,
  user,
  isBot: false,
  url: '',
  createdAt,
})

const NOW = '2026-03-17T00:00:00Z'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(NOW))
})
afterEach(() => {
  vi.useRealTimers()
})

const daysAgo = (n: number) => dayjs.utc(NOW).subtract(n, 'day').toISOString()

describe('analyzeReviewResponse', () => {
  it('returns empty for no comments', () => {
    expect(analyzeReviewResponse([])).toEqual([])
  })

  it('returns empty when all comments are from the same user', () => {
    const result = analyzeReviewResponse([
      comment('alice', daysAgo(1)),
      comment('alice', daysAgo(0)),
    ])
    expect(result).toEqual([])
  })

  it('calculates response time when reviewer changes', () => {
    const t1 = daysAgo(2)
    const t2 = dayjs.utc(t1).add(2, 'hour').toISOString()
    const result = analyzeReviewResponse([
      comment('alice', t1),
      comment('bob', t2),
    ])
    expect(result).toHaveLength(1)
    expect(result[0].author).toBe('bob')
    expect(result[0].responseTime).toBe(2) // 2 hours
  })

  it('tracks multiple reviewer changes', () => {
    const t1 = daysAgo(3)
    const t2 = dayjs.utc(t1).add(1, 'hour').toISOString()
    const t3 = dayjs.utc(t1).add(3, 'hour').toISOString()
    const result = analyzeReviewResponse([
      comment('alice', t1),
      comment('bob', t2),
      comment('alice', t3),
    ])
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ author: 'bob', responseTime: 1 })
    expect(result[1]).toMatchObject({ author: 'alice', responseTime: 2 })
  })

  it('filters out comments older than 90 days', () => {
    const result = analyzeReviewResponse([
      comment('alice', daysAgo(91)),
      comment('bob', daysAgo(91)),
    ])
    expect(result).toEqual([])
  })
})
