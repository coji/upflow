import { describe, expect, test } from 'vitest'
import { reviewTime } from './cycletime'

describe('reviewTime', () => {
  test('null', () => {
    expect(reviewTime({ firstReviewedAt: null, mergedAt: null })).toBeNull()
    expect(
      reviewTime({ firstReviewedAt: '2022-08-01T10:00:00Z', mergedAt: null }),
    ).toBeNull()
    expect(
      reviewTime({ firstReviewedAt: null, mergedAt: '2022-08-01T10:00:00Z' }),
    ).toBeNull()
  })

  test('reviews 24 hours', () => {
    expect(
      reviewTime({
        firstReviewedAt: '2022-08-01T10:00:00Z',
        mergedAt: '2022-08-02T10:00:00Z',
      }),
    ).toStrictEqual(1)

    expect(
      reviewTime({
        firstReviewedAt: '2022-08-02T10:00:00Z',
        mergedAt: '2022-08-01T10:00:00Z',
      }),
    ).toStrictEqual(1)
  })
})
