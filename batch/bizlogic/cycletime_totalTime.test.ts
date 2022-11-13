import { describe, test } from 'vitest'
import { totalTime } from './cycletime'

describe('totalTime', () => {
  test('only created pull request', () => {
    expect(
      totalTime({
        firstCommittedAt: null,
        pullRequestCreatedAt: '2022-08-01 10:00',
        firstReviewedAt: null,
        mergedAt: null,
        releasedAt: null
      })
    ).toStrictEqual(0)
  })

  test('all specified in same', () => {
    expect(
      totalTime({
        firstCommittedAt: '2022-08-01 10:00',
        pullRequestCreatedAt: '2022-08-01 10:00',
        firstReviewedAt: '2022-08-01 10:00',
        mergedAt: '2022-08-01 10:00',
        releasedAt: '2022-08-01 10:00'
      })
    ).toStrictEqual(0)
  })

  test('24 hours', () => {
    expect(
      totalTime({
        firstCommittedAt: '2022-08-01 10:00',
        pullRequestCreatedAt: '2022-08-02 10:00',
        firstReviewedAt: '2022-08-01 10:00',
        mergedAt: '2022-08-01 10:00',
        releasedAt: '2022-08-01 10:00'
      })
    ).toStrictEqual(1)
  })
})
