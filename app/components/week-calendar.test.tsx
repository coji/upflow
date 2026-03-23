import { describe, expect, test } from 'vitest'
import dayjs from '~/app/libs/dayjs'
import { getWeekInterval } from './week-calendar'

describe('getWeekInterval', () => {
  test('aligns calendar day with org timezone, not host local', () => {
    // Monday 2025-03-24 00:00:00 Asia/Tokyo → Sunday 15:00 UTC same calendar week in JP
    const instant = new Date('2025-03-23T15:00:00.000Z')
    const tz = 'Asia/Tokyo'
    const { start, end } = getWeekInterval(instant, 1, tz)
    expect(dayjs(start).tz(tz).format('YYYY-MM-DD')).toBe('2025-03-24')
    expect(dayjs(end).tz(tz).format('YYYY-MM-DD')).toBe('2025-03-30')
  })
})
