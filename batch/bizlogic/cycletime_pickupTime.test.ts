import { describe, expect, test } from 'vitest'
import { pickupTime } from './cycletime'

describe('pickupTime', () => {
  test('null', () => {
    expect(
      pickupTime({
        pullRequestCreatedAt: '2022-08-01T10:00:00Z',
        firstReviewedAt: null,
        mergedAt: null,
      }),
    ).toBeNull()
  })

  test('reviewed at 24 hours after not merged yet', () => {
    expect(
      pickupTime({
        pullRequestCreatedAt: '2022-08-01T10:00:00Z',
        firstReviewedAt: '2022-08-02T10:00:00Z',
        mergedAt: null,
      }),
    ).toStrictEqual(1)
  })

  test('merged at 24 hours after with no review', () => {
    expect(
      pickupTime({
        pullRequestCreatedAt: '2022-08-01T10:00:00Z',
        firstReviewedAt: null,
        mergedAt: '2022-08-02T10:00:00Z',
      }),
    ).toStrictEqual(1)
  })

  test('reviewed at 24 hours after and merged after 48 hours', () => {
    expect(
      pickupTime({
        pullRequestCreatedAt: '2022-08-01T10:00:00Z',
        firstReviewedAt: '2022-08-02T10:00:00Z',
        mergedAt: '2022-08-03T10:00:00Z',
      }),
    ).toStrictEqual(1)
  })
})
