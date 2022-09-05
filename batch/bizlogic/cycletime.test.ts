import { describe, test, expect } from 'vitest'
import { codingTime } from './cycletime'

describe('codingTime', () => {
  test('all null', () => {
    expect(codingTime({ firstCommittedAt: null, pullRequestCreatedAt: null })).toBeNull()
  })

  test('null if firstCommitedAt is null', () => {
    expect(codingTime({ firstCommittedAt: null, pullRequestCreatedAt: '2022-08-01 10:00' })).toBeNull()
  })

  test('null if pullRequestCreatedAt is null', () => {
    expect(codingTime({ firstCommittedAt: '2022-08-01 10:00', pullRequestCreatedAt: null })).toBeNull()
  })

  test('zero if same timestamp', () => {
    expect(
      codingTime({ firstCommittedAt: '2022-08-10 10:00', pullRequestCreatedAt: '2022-08-10 10:00' })
    ).toStrictEqual(0)
  })

  test('diff when first committed at before than pull request created at', () => {
    expect(
      codingTime({ firstCommittedAt: '2022-08-01 10:00', pullRequestCreatedAt: '2022-08-02 11:00' })
    ).toStrictEqual(1 + 1 / 24)
  })

  test('diff when first committed at after than pull request created at', () => {
    expect(
      codingTime({ firstCommittedAt: '2022-08-02 11:00', pullRequestCreatedAt: '2022-08-01 10:00' })
    ).toStrictEqual(1 + 1 / 24)
  })

  test('diff one year', () => {
    expect(
      codingTime({ firstCommittedAt: '2022-08-01 10:00', pullRequestCreatedAt: '2023-08-01 10:00' })
    ).toStrictEqual(365)
  })

  test('diff when after the unix time end', () => {
    expect(
      codingTime({ firstCommittedAt: '2022-08-01 10:00', pullRequestCreatedAt: '2062-08-01 10:00' })
    ).toStrictEqual(40 * 365 + 10) // うるう年が10年 = +10日分ある
  })
})
