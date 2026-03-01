import { describe, expect, test } from 'vitest'
import { calculateBusinessHours } from './business-hours'

describe('calculateBusinessHours', () => {
  // All times in Asia/Tokyo timezone

  test('returns 0 when start equals end', () => {
    const result = calculateBusinessHours(
      '2024-01-15T10:00:00+09:00',
      '2024-01-15T10:00:00+09:00',
    )
    expect(result).toBe(0)
  })

  test('returns 0 when start is after end', () => {
    const result = calculateBusinessHours(
      '2024-01-15T12:00:00+09:00',
      '2024-01-15T10:00:00+09:00',
    )
    expect(result).toBe(0)
  })

  test('calculates hours within a single weekday', () => {
    // Monday Jan 15, 2024: 10:00 -> 18:00 = 8 hours
    const result = calculateBusinessHours(
      '2024-01-15T10:00:00+09:00',
      '2024-01-15T18:00:00+09:00',
    )
    expect(result).toBe(8)
  })

  test('returns 0 for weekend days', () => {
    // Saturday Jan 13, 2024
    const result = calculateBusinessHours(
      '2024-01-13T10:00:00+09:00',
      '2024-01-13T18:00:00+09:00',
    )
    expect(result).toBe(0)
  })

  test('returns 0 for Sunday', () => {
    // Sunday Jan 14, 2024
    const result = calculateBusinessHours(
      '2024-01-14T10:00:00+09:00',
      '2024-01-14T18:00:00+09:00',
    )
    expect(result).toBe(0)
  })

  test('returns 0 for a Japanese holiday (New Year)', () => {
    // Jan 1, 2024 is a Japanese holiday (元日) and also Monday
    const result = calculateBusinessHours(
      '2024-01-01T10:00:00+09:00',
      '2024-01-01T18:00:00+09:00',
    )
    expect(result).toBe(0)
  })

  test('calculates hours across multiple weekdays', () => {
    // Mon Jan 15 10:00 -> Wed Jan 17 10:00
    // Mon: 14h (10:00->24:00), Tue: 24h, Wed: 10h (00:00->10:00)
    const result = calculateBusinessHours(
      '2024-01-15T10:00:00+09:00',
      '2024-01-17T10:00:00+09:00',
    )
    expect(result).toBeCloseTo(48, 0) // 2 full days = 48h
  })

  test('skips weekends in multi-day range', () => {
    // Fri Jan 12 00:00 -> Mon Jan 15 00:00 (JST)
    // Fri: 24h, Sat: skip, Sun: skip, Mon: 0h (starts at 00:00)
    const result = calculateBusinessHours(
      '2024-01-12T00:00:00+09:00',
      '2024-01-15T00:00:00+09:00',
    )
    expect(result).toBeCloseTo(24, 0) // only Friday
  })

  test('handles a full business week (Mon-Fri)', () => {
    // Mon Jan 15 00:00 -> Sat Jan 20 00:00
    // 5 weekdays * 24h = 120h
    const result = calculateBusinessHours(
      '2024-01-15T00:00:00+09:00',
      '2024-01-20T00:00:00+09:00',
    )
    expect(result).toBeCloseTo(120, 0)
  })

  test('handles a long range efficiently (1 year)', () => {
    // This should NOT be slow - the whole point of the optimization
    const start = performance.now()
    const result = calculateBusinessHours(
      '2023-01-01T00:00:00+09:00',
      '2024-01-01T00:00:00+09:00',
    )
    const elapsed = performance.now() - start

    // Should complete in well under 100ms (was seconds before optimization)
    expect(elapsed).toBeLessThan(100)
    // ~261 weekdays in 2023, minus holidays
    expect(result).toBeGreaterThan(200 * 24)
    expect(result).toBeLessThan(262 * 24)
  })

  test('handles a very long range efficiently (5 years)', () => {
    const start = performance.now()
    const result = calculateBusinessHours(
      '2020-01-01T00:00:00+09:00',
      '2025-01-01T00:00:00+09:00',
    )
    const elapsed = performance.now() - start

    expect(elapsed).toBeLessThan(100)
    expect(result).toBeGreaterThan(1000 * 24)
  })
})
