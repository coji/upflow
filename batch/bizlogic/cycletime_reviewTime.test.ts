import { describe, expect, test } from 'vitest'
import { reviewTime } from './cycletime'

describe('reviewTime', () => {
  test('null', () => {
    expect(reviewTime({ firstReviewedAt: null, mergedAt: null })).toBeNull()
    expect(reviewTime({ firstReviewedAt: '2022-08-01 10:00', mergedAt: null })).toBeNull()
    expect(reviewTime({ firstReviewedAt: null, mergedAt: '2022-08-01 10:00' })).toBeNull()
  })

  test('reviews 24 hours', () => {
    expect(
      reviewTime({
        firstReviewedAt: '2022-08-01 10:00',
        mergedAt: '2022-08-02 10:00',
      }),
    ).toStrictEqual(1)

    expect(
      reviewTime({
        firstReviewedAt: '2022-08-02 10:00',
        mergedAt: '2022-08-01 10:00',
      }),
    ).toStrictEqual(1)
  })
})
