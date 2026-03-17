import { describe, expect, it } from 'vitest'
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

describe('analyzeReviewResponse', () => {
  it('returns empty for no comments', () => {
    expect(analyzeReviewResponse([])).toEqual([])
  })

  it('returns empty when all comments are from the same user', () => {
    const result = analyzeReviewResponse([
      comment('alice', '2026-03-01T10:00:00Z'),
      comment('alice', '2026-03-01T11:00:00Z'),
    ])
    expect(result).toEqual([])
  })

  it('calculates response time when reviewer changes', () => {
    const result = analyzeReviewResponse([
      comment('alice', '2026-03-01T10:00:00Z'),
      comment('bob', '2026-03-01T12:00:00Z'),
    ])
    expect(result).toHaveLength(1)
    expect(result[0].author).toBe('bob')
    expect(result[0].responseTime).toBe(2) // 2 hours
  })

  it('tracks multiple reviewer changes', () => {
    const result = analyzeReviewResponse([
      comment('alice', '2026-03-01T10:00:00Z'),
      comment('bob', '2026-03-01T11:00:00Z'),
      comment('alice', '2026-03-01T13:00:00Z'),
    ])
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ author: 'bob', responseTime: 1 })
    expect(result[1]).toMatchObject({ author: 'alice', responseTime: 2 })
  })

  it('filters out comments older than 90 days', () => {
    const result = analyzeReviewResponse([
      comment('alice', '2025-01-01T10:00:00Z'),
      comment('bob', '2025-01-01T12:00:00Z'),
    ])
    expect(result).toEqual([])
  })
})
