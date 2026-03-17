import { describe, expect, it } from 'vitest'
import { timeFormatTz } from './timeformat'

describe('timeFormatTz', () => {
  it('converts ISO 8601 UTC to Asia/Tokyo', () => {
    expect(timeFormatTz('2026-03-16T02:56:35Z', 'Asia/Tokyo')).toBe(
      '2026-03-16 11:56:35',
    )
  })

  it('converts ISO 8601 UTC to US/Pacific', () => {
    expect(timeFormatTz('2026-03-16T02:56:35Z', 'US/Pacific')).toBe(
      '2026-03-15 19:56:35',
    )
  })

  it('returns null for null input', () => {
    expect(timeFormatTz(null, 'Asia/Tokyo')).toBeNull()
  })

  it('returns null for undefined input', () => {
    expect(timeFormatTz(undefined, 'Asia/Tokyo')).toBeNull()
  })
})
