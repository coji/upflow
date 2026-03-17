import { describe, expect, test } from 'vitest'
import { totalTime } from './cycletime'

describe('totalTime', () => {
  test('only created pull request', () => {
    expect(
      totalTime({
        firstCommittedAt: null,
        pullRequestCreatedAt: '2022-08-01T10:00:00Z',
        firstReviewedAt: null,
        mergedAt: null,
        releasedAt: null,
      }),
    ).toStrictEqual(0)
  })

  test('all specified in same', () => {
    expect(
      totalTime({
        firstCommittedAt: '2022-08-01T10:00:00Z',
        pullRequestCreatedAt: '2022-08-01T10:00:00Z',
        firstReviewedAt: '2022-08-01T10:00:00Z',
        mergedAt: '2022-08-01T10:00:00Z',
        releasedAt: '2022-08-01T10:00:00Z',
      }),
    ).toStrictEqual(0)
  })

  test('24 hours', () => {
    expect(
      totalTime({
        firstCommittedAt: '2022-08-01T10:00:00Z',
        pullRequestCreatedAt: '2022-08-02T10:00:00Z',
        firstReviewedAt: '2022-08-01T10:00:00Z',
        mergedAt: '2022-08-01T10:00:00Z',
        releasedAt: '2022-08-01T10:00:00Z',
      }),
    ).toStrictEqual(1)
  })
})
