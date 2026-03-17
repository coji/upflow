import { describe, expect, test } from 'vitest'
import { codingTime } from './cycletime'

describe('codingTime', () => {
  test('all null', () => {
    expect(
      codingTime({
        firstCommittedAt: null,
        pullRequestCreatedAt: null,
      }),
    ).toBeNull()
  })

  test('null if firstCommittedAt is null', () => {
    expect(
      codingTime({
        firstCommittedAt: null,
        pullRequestCreatedAt: '2022-08-01T10:00:00Z',
      }),
    ).toBeNull()
  })

  test('null if pullRequestCreatedAt is null', () => {
    expect(
      codingTime({
        firstCommittedAt: '2022-08-01T10:00:00Z',
        pullRequestCreatedAt: null,
      }),
    ).toBeNull()
  })

  test('zero if same timestamp', () => {
    expect(
      codingTime({
        firstCommittedAt: '2022-08-10T10:00:00Z',
        pullRequestCreatedAt: '2022-08-10T10:00:00Z',
      }),
    ).toStrictEqual(0)
  })

  test('diff when first committed at before than pull request created at', () => {
    expect(
      codingTime({
        firstCommittedAt: '2022-08-01T10:00:00Z',
        pullRequestCreatedAt: '2022-08-02T11:00:00Z',
      }),
    ).toStrictEqual(1 + 1 / 24)
  })

  test('diff when first committed at after than pull request created at', () => {
    expect(
      codingTime({
        firstCommittedAt: '2022-08-02T11:00:00Z',
        pullRequestCreatedAt: '2022-08-01T10:00:00Z',
      }),
    ).toStrictEqual(1 + 1 / 24)
  })

  test('diff one year', () => {
    expect(
      codingTime({
        firstCommittedAt: '2022-08-01T10:00:00Z',
        pullRequestCreatedAt: '2023-08-01T10:00:00Z',
      }),
    ).toStrictEqual(365)
  })

  test('diff when after the unix time end', () => {
    expect(
      codingTime({
        firstCommittedAt: '2022-08-01T10:00:00Z',
        pullRequestCreatedAt: '2062-08-01T10:00:00Z',
      }),
    ).toStrictEqual(40 * 365 + 10) // うるう年が10年 = +10日分ある
  })
})
