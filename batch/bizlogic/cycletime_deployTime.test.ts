import { describe, expect, test } from 'vitest'
import { deployTime } from './cycletime'

describe('deployTime', () => {
  test('null', () => {
    expect(deployTime({ mergedAt: null, releasedAt: null })).toBeNull()
    expect(
      deployTime({ mergedAt: '2022-08-01T10:00:00Z', releasedAt: null }),
    ).toBeNull()
    expect(
      deployTime({ mergedAt: null, releasedAt: '2022-08-01T10:00:00Z' }),
    ).toBeNull()
  })

  test('deploy on 24 hours', () => {
    expect(
      deployTime({
        mergedAt: '2022-08-01T10:00:00Z',
        releasedAt: '2022-08-02T10:00:00Z',
      }),
    ).toStrictEqual(1)
    expect(
      deployTime({
        mergedAt: '2022-08-02T10:00:00Z',
        releasedAt: '2022-08-01T10:00:00Z',
      }),
    ).toStrictEqual(1)
  })
})
