import { describe, expect, test } from 'vitest'
import {
  computeAdvancedScanWatermark,
  SCAN_WATERMARK_CLOCK_MARGIN_MS,
} from './scan-watermark'

// Long after every updatedAt below, so the cap does not apply.
const LATER = '2026-03-16T15:00:00.000Z'

describe('computeAdvancedScanWatermark', () => {
  test('targeted fetch never advances the watermark', () => {
    expect(
      computeAdvancedScanWatermark({
        isTargetedFetch: true,
        prsToFetch: [{ number: 101, updatedAt: '2026-03-16T13:55:00Z' }],
        savedPrNumbers: new Set([101]),
        listStartedAt: LATER,
        listComplete: true,
      }),
    ).toBeNull()
  })

  test('empty sweep leaves watermark unchanged', () => {
    expect(
      computeAdvancedScanWatermark({
        isTargetedFetch: false,
        prsToFetch: [],
        savedPrNumbers: new Set(),
        listStartedAt: LATER,
        listComplete: true,
      }),
    ).toBeNull()
  })

  test('fully successful full sweep advances to max updatedAt', () => {
    expect(
      computeAdvancedScanWatermark({
        isTargetedFetch: false,
        prsToFetch: [
          { number: 100, updatedAt: '2026-03-16T13:45:00Z' },
          { number: 101, updatedAt: '2026-03-16T13:55:00Z' },
          { number: 99, updatedAt: '2026-03-16T13:30:00Z' },
        ],
        savedPrNumbers: new Set([100, 101, 99]),
        listStartedAt: LATER,
        listComplete: true,
      }),
    ).toBe('2026-03-16T13:55:00Z')
  })

  test('advancement requires set membership, not just matching counts', () => {
    // If savedPrNumbers ever contains unrelated numbers (e.g. a caller bug
    // or concurrent mutation), the function must still refuse to advance.
    expect(
      computeAdvancedScanWatermark({
        isTargetedFetch: false,
        prsToFetch: [
          { number: 100, updatedAt: '2026-03-16T13:45:00Z' },
          { number: 101, updatedAt: '2026-03-16T13:55:00Z' },
        ],
        savedPrNumbers: new Set([101, 999]),
        listStartedAt: LATER,
        listComplete: true,
      }),
    ).toBeNull()
  })

  test('partial failure does NOT advance the watermark', () => {
    // PR#100 (13:45) failed, PR#101 (13:55) succeeded. If we advanced to
    // 13:55 here, the next full crawl would stopBefore=13:55 and skip
    // PR#100 forever. See #278.
    expect(
      computeAdvancedScanWatermark({
        isTargetedFetch: false,
        prsToFetch: [
          { number: 100, updatedAt: '2026-03-16T13:45:00Z' },
          { number: 101, updatedAt: '2026-03-16T13:55:00Z' },
        ],
        savedPrNumbers: new Set([101]),
        listStartedAt: LATER,
        listComplete: true,
      }),
    ).toBeNull()
  })

  test('gap-recovery scenario: full crawl after targeted webhook fetch picks up the older PR', () => {
    // Reproduces the #278 scenario end-to-end at the pure-logic level:
    //   1. 13:30 prior full sweep advanced watermark to 13:30
    //   2. 13:45 PR#100 merged (webhook not yet subscribed, so no fetch)
    //   3. 13:55 PR#101 comment → webhook targeted fetch saves PR#101 only.
    //      computeAdvancedScanWatermark returns null → watermark stays 13:30.
    //   4. 14:30 scheduled full crawl runs pullrequestList(stopBefore=13:30)
    //      and sees both PR#101 (13:55) and PR#100 (13:45). Both save.
    //      Watermark advances to 13:55.
    const targeted = computeAdvancedScanWatermark({
      isTargetedFetch: true,
      prsToFetch: [{ number: 101, updatedAt: '2026-03-16T13:55:00Z' }],
      savedPrNumbers: new Set([101]),
      listStartedAt: LATER,
      listComplete: true,
    })
    expect(targeted).toBeNull() // watermark still 13:30

    const fullSweep = computeAdvancedScanWatermark({
      isTargetedFetch: false,
      prsToFetch: [
        { number: 101, updatedAt: '2026-03-16T13:55:00Z' },
        { number: 100, updatedAt: '2026-03-16T13:45:00Z' },
      ],
      savedPrNumbers: new Set([100, 101]),
      listStartedAt: LATER,
      listComplete: true,
    })
    expect(fullSweep).toBe('2026-03-16T13:55:00Z')
  })

  test('a sweep with no list start time does not advance', () => {
    expect(
      computeAdvancedScanWatermark({
        isTargetedFetch: false,
        prsToFetch: [{ number: 101, updatedAt: '2026-03-16T13:55:00Z' }],
        savedPrNumbers: new Set([101]),
        listStartedAt: null,
        listComplete: true,
      }),
    ).toBeNull()
  })

  test('the watermark stays the margin before the list read', () => {
    // The list is read at 13:55:05.123 and its newest PR changed at 13:55:05.
    // That second had not ended: a PR updated later in it also gets 13:55:05.
    expect(SCAN_WATERMARK_CLOCK_MARGIN_MS).toBe(5 * 60 * 1000)
    expect(
      computeAdvancedScanWatermark({
        isTargetedFetch: false,
        prsToFetch: [
          { number: 101, updatedAt: '2026-03-16T13:55:05Z' },
          { number: 100, updatedAt: '2026-03-16T13:40:00Z' },
        ],
        savedPrNumbers: new Set([100, 101]),
        listStartedAt: '2026-03-16T13:55:05.123Z',
        listComplete: true,
      }),
    ).toBe('2026-03-16T13:50:05Z')
  })

  test('the cap uses the same form as GitHub updatedAt (whole seconds, Z)', () => {
    const watermark = computeAdvancedScanWatermark({
      isTargetedFetch: false,
      prsToFetch: [{ number: 101, updatedAt: '2026-03-16T13:55:05Z' }],
      savedPrNumbers: new Set([101]),
      listStartedAt: '2026-03-16T13:55:05.999Z',
      listComplete: true,
    })
    expect(watermark).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/)
    // String comparison with updatedAt must order them by time.
    expect('2026-03-16T13:50:05Z' <= (watermark ?? '')).toBe(true)
    expect('2026-03-16T13:50:06Z' <= (watermark ?? '')).toBe(false)
  })

  test('same-second scenario: a PR updated in the second of the list read is listed again', () => {
    // 1. 13:55:05.200 the sweep reads the list. PR#101 changed at 13:55:05.
    // 2. 13:55:05.800 PR#101 changes again: updatedAt is still 13:55:05,
    //    and its webhook is dropped (it joins a waiting crawl).
    // 3. The next sweep stops at updatedAt <= watermark. With the watermark at
    //    13:55:05 it would skip PR#101 forever; capped, it lists it again.
    const watermark = computeAdvancedScanWatermark({
      isTargetedFetch: false,
      prsToFetch: [{ number: 101, updatedAt: '2026-03-16T13:55:05Z' }],
      savedPrNumbers: new Set([101]),
      listStartedAt: '2026-03-16T13:55:05.200Z',
      listComplete: true,
    })
    expect(watermark).toBe('2026-03-16T13:50:05Z')
    const nextSweepStopsAt = (updatedAt: string) =>
      watermark !== null && updatedAt <= watermark
    expect(nextSweepStopsAt('2026-03-16T13:55:05Z')).toBe(false)
  })

  test('a PR list with gaps (GraphQL partial error) never advances', () => {
    expect(
      computeAdvancedScanWatermark({
        isTargetedFetch: false,
        prsToFetch: [
          { number: 1, updatedAt: '2026-03-16T13:00:00Z' },
          { number: 2, updatedAt: '2026-03-16T13:10:00Z' },
        ],
        savedPrNumbers: new Set([1, 2]),
        listStartedAt: LATER,
        listComplete: false,
      }),
    ).toBeNull()
  })
})
