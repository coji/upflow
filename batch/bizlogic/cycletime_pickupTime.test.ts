import { describe, test, expect } from 'vitest'
import { pickupTime } from './cycletime'

describe('pickupTime', () => {
  test('null', () => {
    expect(
      pickupTime({
        pullRequestCreatedAt: '2022-08-01 10:00',
        firstReviewedAt: null,
        mergedAt: null,
      }),
    ).toBeNull()
  })

  test('reviewed at 24 hours after not merged yet', () => {
    expect(
      pickupTime({
        pullRequestCreatedAt: '2022-08-01 10:00',
        firstReviewedAt: '2022-08-02 10:00',
        mergedAt: null,
      }),
    ).toStrictEqual(1)
  })

  test('merged at 24 hours after with no review', () => {
    expect(
      pickupTime({
        pullRequestCreatedAt: '2022-08-01 10:00',
        firstReviewedAt: null,
        mergedAt: '2022-08-02 10:00',
      }),
    ).toStrictEqual(1)
  })

  test('reviewed at 24 hours after and merged after 48 hours', () => {
    expect(
      pickupTime({
        pullRequestCreatedAt: '2022-08-01 10:00',
        firstReviewedAt: '2022-08-02 10:00',
        mergedAt: '2022-08-03 10:00',
      }),
    ).toStrictEqual(1)
  })
})
