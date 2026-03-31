import { describe, expect, test } from 'vitest'
import { pickupTime } from './cycletime'

describe('pickupTime', () => {
  test('null when no review, no merge, no state machine result', () => {
    expect(
      pickupTime({
        pickupTimeDays: null,
        pullRequestCreatedAt: '2022-08-01T10:00:00Z',
        firstReviewedAt: null,
        mergedAt: null,
      }),
    ).toBeNull()
  })

  test('uses pickupTimeDays from state machine when present', () => {
    expect(
      pickupTime({
        pickupTimeDays: 0.5,
        pullRequestCreatedAt: '2022-08-01T10:00:00Z',
        firstReviewedAt: '2022-08-02T10:00:00Z',
        mergedAt: null,
      }),
    ).toStrictEqual(0.5)
  })

  test('uses pickupTimeDays even when 0', () => {
    expect(
      pickupTime({
        pickupTimeDays: 0,
        pullRequestCreatedAt: '2022-08-01T10:00:00Z',
        firstReviewedAt: '2022-08-02T10:00:00Z',
        mergedAt: null,
      }),
    ).toStrictEqual(0)
  })

  test('fallback: reviewed at 24 hours after (no state machine)', () => {
    expect(
      pickupTime({
        pickupTimeDays: null,
        pullRequestCreatedAt: '2022-08-01T10:00:00Z',
        firstReviewedAt: '2022-08-02T10:00:00Z',
        mergedAt: null,
      }),
    ).toStrictEqual(1)
  })

  test('fallback: merged at 24 hours after with no review', () => {
    expect(
      pickupTime({
        pickupTimeDays: null,
        pullRequestCreatedAt: '2022-08-01T10:00:00Z',
        firstReviewedAt: null,
        mergedAt: '2022-08-02T10:00:00Z',
      }),
    ).toStrictEqual(1)
  })

  test('fallback: reviewed at 24 hours after and merged after 48 hours', () => {
    expect(
      pickupTime({
        pickupTimeDays: null,
        pullRequestCreatedAt: '2022-08-01T10:00:00Z',
        firstReviewedAt: '2022-08-02T10:00:00Z',
        mergedAt: '2022-08-03T10:00:00Z',
      }),
    ).toStrictEqual(1)
  })
})
