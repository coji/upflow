import { describe, expect, test } from 'vitest'
import { computeAdvancedScanWatermark } from './scan-watermark'

describe('computeAdvancedScanWatermark', () => {
  test('targeted fetch never advances the watermark', () => {
    expect(
      computeAdvancedScanWatermark({
        isTargetedFetch: true,
        prsToFetch: [{ number: 101, updatedAt: '2026-03-16T13:55:00Z' }],
        savedPrNumbers: new Set([101]),
      }),
    ).toBeNull()
  })

  test('empty sweep leaves watermark unchanged', () => {
    expect(
      computeAdvancedScanWatermark({
        isTargetedFetch: false,
        prsToFetch: [],
        savedPrNumbers: new Set(),
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
    })
    expect(targeted).toBeNull() // watermark still 13:30

    const fullSweep = computeAdvancedScanWatermark({
      isTargetedFetch: false,
      prsToFetch: [
        { number: 101, updatedAt: '2026-03-16T13:55:00Z' },
        { number: 100, updatedAt: '2026-03-16T13:45:00Z' },
      ],
      savedPrNumbers: new Set([100, 101]),
    })
    expect(fullSweep).toBe('2026-03-16T13:55:00Z')
  })
})
