import { describe, expect, test } from 'bun:test'
import { deployTime } from './cycletime'

describe('deployTime', () => {
  test('null', () => {
    expect(deployTime({ mergedAt: null, releasedAt: null })).toBeNull()
    expect(deployTime({ mergedAt: '2022-08-01 10:00', releasedAt: null })).toBeNull()
    expect(deployTime({ mergedAt: null, releasedAt: '2022-08-01 10:00' })).toBeNull()
  })

  test('deploy on 24 hours', () => {
    expect(deployTime({ mergedAt: '2022-08-01 10:00', releasedAt: '2022-08-02 10:00' })).toStrictEqual(1)
    expect(deployTime({ mergedAt: '2022-08-02 10:00', releasedAt: '2022-08-01 10:00' })).toStrictEqual(1)
  })
})
