import { describe, expect, test } from 'vitest'
import {
  computeAuthorRows,
  computeBottleneckMix,
  computeInsights,
  computeKpi,
  computeLongestPrs,
  computeWeeklyTrend,
  filterRowsByWeek,
  type CycleTimeRawRow,
} from './aggregate'

const baseRow = (overrides: Partial<CycleTimeRawRow>): CycleTimeRawRow => ({
  repositoryId: 'repo-1',
  repo: 'service-a',
  number: 1,
  title: 'sample pr',
  url: 'https://example.invalid/pulls/1',
  author: 'alpha',
  authorDisplayName: 'Alpha User',
  state: 'merged',
  pullRequestCreatedAt: '2026-03-01T00:00:00.000Z',
  mergedAt: '2026-03-02T00:00:00.000Z',
  releasedAt: '2026-03-03T00:00:00.000Z',
  codingTime: 1,
  pickupTime: 1,
  reviewTime: 1,
  deployTime: 1,
  totalTime: 4,
  ...overrides,
})

describe('computeKpi', () => {
  test('median mode picks median per stage and counts PRs', () => {
    const rows = [
      baseRow({ number: 1, totalTime: 2, reviewTime: 1, deployTime: 1 }),
      baseRow({ number: 2, totalTime: 6, reviewTime: 3, deployTime: 2 }),
      baseRow({ number: 3, totalTime: 4, reviewTime: 2, deployTime: 4 }),
    ]
    const prevRows = [
      baseRow({ number: 99, totalTime: 5, reviewTime: 2, deployTime: 2 }),
    ]
    const kpi = computeKpi(rows, prevRows, 'median')
    expect(kpi.total).toBe(4)
    expect(kpi.review).toBe(2)
    expect(kpi.deploy).toBe(2)
    expect(kpi.prCount).toBe(3)
    expect(kpi.totalDelta.diff).toBe(-1)
  })

  test('average mode differs from median', () => {
    const rows = [
      baseRow({ number: 1, totalTime: 1 }),
      baseRow({ number: 2, totalTime: 1 }),
      baseRow({ number: 3, totalTime: 10 }),
    ]
    const med = computeKpi(rows, [], 'median')
    const avg = computeKpi(rows, [], 'average')
    expect(med.total).toBe(1)
    expect(avg.total).toBeCloseTo(4)
  })

  test('null stage values are excluded, not zeroed', () => {
    const rows = [
      baseRow({ number: 1, reviewTime: null, totalTime: 5 }),
      baseRow({ number: 2, reviewTime: 3, totalTime: 5 }),
    ]
    expect(computeKpi(rows, [], 'median').review).toBe(3)
  })

  test('empty current rows yields null metrics and zero count', () => {
    const kpi = computeKpi([], [], 'median')
    expect(kpi.total).toBeNull()
    expect(kpi.prCount).toBe(0)
    expect(kpi.totalDelta.diff).toBeNull()
  })
})

describe('computeWeeklyTrend', () => {
  test('buckets PRs by Monday-start week in given timezone', () => {
    const since = '2026-03-02T00:00:00.000Z' // Mon
    const until = '2026-03-23T00:00:00.000Z' // Mon (exclusive end)
    const rows = [
      // Week 1: 2026-03-02 - 2026-03-08 — baseRow has all stages = 1
      baseRow({
        number: 1,
        releasedAt: '2026-03-04T05:00:00.000Z',
        totalTime: 4,
      }),
      baseRow({
        number: 2,
        releasedAt: '2026-03-08T22:00:00.000Z',
        totalTime: 6,
      }),
      // Week 2: 2026-03-09 - 2026-03-15
      baseRow({
        number: 3,
        releasedAt: '2026-03-12T01:00:00.000Z',
        totalTime: 8,
      }),
      // Week 3: 2026-03-16 - 2026-03-22 (no PRs)
    ]
    const trend = computeWeeklyTrend(rows, since, until, 'UTC', 'median')
    expect(trend).toHaveLength(3)
    expect(trend[0].prCount).toBe(2)
    // Sum of stage medians (1+1+1+1) — matches the stacked bar height
    expect(trend[0].total).toBe(4)
    expect(trend[1].prCount).toBe(1)
    expect(trend[1].total).toBe(4)
    expect(trend[2].prCount).toBe(0)
    expect(trend[2].total).toBeNull()
  })

  test('total equals sum of stage medians, not median of totalTime', () => {
    // Three PRs whose stage medians sum to 7 but median(totalTime) = 9.
    const rows = [
      baseRow({
        number: 1,
        releasedAt: '2026-03-03T00:00:00.000Z',
        codingTime: 1,
        pickupTime: 1,
        reviewTime: 1,
        deployTime: 1,
        totalTime: 4,
      }),
      baseRow({
        number: 2,
        releasedAt: '2026-03-04T00:00:00.000Z',
        codingTime: 2,
        pickupTime: 2,
        reviewTime: 2,
        deployTime: 2,
        totalTime: 9,
      }),
      baseRow({
        number: 3,
        releasedAt: '2026-03-05T00:00:00.000Z',
        codingTime: 5,
        pickupTime: 5,
        reviewTime: 5,
        deployTime: 5,
        totalTime: 30,
      }),
    ]
    const trend = computeWeeklyTrend(
      rows,
      '2026-03-02T00:00:00.000Z',
      '2026-03-09T00:00:00.000Z',
      'UTC',
      'median',
    )
    expect(trend).toHaveLength(1)
    expect(trend[0].coding).toBe(2)
    expect(trend[0].pickup).toBe(2)
    expect(trend[0].review).toBe(2)
    expect(trend[0].deploy).toBe(2)
    // sum of stage medians = 8, NOT median(totalTime) = 9
    expect(trend[0].total).toBe(8)
  })

  test('week start follows Asia/Tokyo when timezone shifts the day', () => {
    // 2026-03-01 23:00 UTC = 2026-03-02 08:00 Asia/Tokyo (Mon)
    const since = '2026-03-02T00:00:00.000Z'
    const until = '2026-03-09T00:00:00.000Z'
    const rows = [
      baseRow({
        number: 1,
        releasedAt: '2026-03-01T23:00:00.000Z',
        totalTime: 5,
      }),
    ]
    const trend = computeWeeklyTrend(rows, since, until, 'Asia/Tokyo', 'median')
    expect(trend.length).toBeGreaterThan(0)
    expect(trend[0].prCount).toBe(1)
    // baseRow stages all = 1 → sum = 4
    expect(trend[0].total).toBe(4)
  })

  test('returns [] when since is not before until', () => {
    expect(
      computeWeeklyTrend(
        [],
        '2026-03-10T00:00:00.000Z',
        '2026-03-01T00:00:00.000Z',
        'UTC',
        'median',
      ),
    ).toEqual([])
  })
})

describe('filterRowsByWeek', () => {
  test('keeps only rows whose release week (Monday-start) matches', () => {
    const rows = [
      baseRow({ number: 1, releasedAt: '2026-03-04T05:00:00.000Z' }), // wk 03-02
      baseRow({ number: 2, releasedAt: '2026-03-08T22:00:00.000Z' }), // wk 03-02
      baseRow({ number: 3, releasedAt: '2026-03-12T01:00:00.000Z' }), // wk 03-09
      baseRow({ number: 4, releasedAt: null }),
    ]
    const out = filterRowsByWeek(rows, '2026-03-02', 'UTC')
    expect(out.map((r) => r.number)).toEqual([1, 2])
  })

  test('uses the given timezone to determine the week boundary', () => {
    // 2026-03-01 23:00 UTC = 2026-03-02 08:00 Asia/Tokyo (Mon)
    const rows = [
      baseRow({ number: 1, releasedAt: '2026-03-01T23:00:00.000Z' }),
    ]
    expect(
      filterRowsByWeek(rows, '2026-03-02', 'Asia/Tokyo').map((r) => r.number),
    ).toEqual([1])
    expect(
      filterRowsByWeek(rows, '2026-03-02', 'UTC').map((r) => r.number),
    ).toEqual([])
  })
})

describe('computeBottleneckMix', () => {
  test('ratios sum to 1 when there is data', () => {
    const rows = [
      baseRow({
        number: 1,
        codingTime: 2,
        pickupTime: 1,
        reviewTime: 4,
        deployTime: 3,
      }),
      baseRow({
        number: 2,
        codingTime: 2,
        pickupTime: 1,
        reviewTime: 4,
        deployTime: 3,
      }),
    ]
    const mix = computeBottleneckMix(rows, 'median')
    const sum = mix.slices.reduce((s, x) => s + x.ratio, 0)
    expect(sum).toBeCloseTo(1)
    const review = mix.slices.find((s) => s.stage === 'review')
    expect(review?.value).toBe(4)
  })

  test('handles empty rows with zero ratios', () => {
    const mix = computeBottleneckMix([], 'median')
    expect(mix.sum).toBe(0)
    for (const s of mix.slices) {
      expect(s.ratio).toBe(0)
      expect(s.value).toBe(0)
    }
  })
})

describe('computeAuthorRows', () => {
  test('groups by author and computes Review p75 and change vs prev', () => {
    const rows = [
      baseRow({
        author: 'alpha',
        authorDisplayName: 'Alpha',
        number: 1,
        reviewTime: 1,
        totalTime: 5,
      }),
      baseRow({
        author: 'alpha',
        authorDisplayName: 'Alpha',
        number: 2,
        reviewTime: 3,
        totalTime: 7,
      }),
      baseRow({
        author: 'alpha',
        authorDisplayName: 'Alpha',
        number: 3,
        reviewTime: 5,
        totalTime: 9,
      }),
      baseRow({
        author: 'beta',
        authorDisplayName: 'Beta',
        number: 4,
        reviewTime: 2,
        totalTime: 4,
      }),
    ]
    const prev = [
      baseRow({
        author: 'alpha',
        authorDisplayName: 'Alpha',
        number: 11,
        totalTime: 10,
      }),
    ]
    const out = computeAuthorRows(rows, prev, 'median')
    expect(out.map((a) => a.author)).toEqual(['alpha', 'beta'])

    const alpha = out.find((a) => a.author === 'alpha')
    expect(alpha?.prCount).toBe(3)
    expect(alpha?.total).toBe(7)
    expect(alpha?.reviewP75).toBeCloseTo(4)
    expect(alpha?.changeVsPrev.diff).toBe(-3)
    expect(alpha?.composition.reduce((s, c) => s + c.ratio, 0)).toBeCloseTo(1)

    const beta = out.find((a) => a.author === 'beta')
    expect(beta?.prCount).toBe(1)
    expect(beta?.changeVsPrev.diff).toBeNull()
  })

  test('main driver is the largest non-zero stage', () => {
    const rows = [
      baseRow({
        author: 'gamma',
        authorDisplayName: 'Gamma',
        number: 1,
        codingTime: 1,
        pickupTime: 0.5,
        reviewTime: 5,
        deployTime: 1,
      }),
    ]
    const out = computeAuthorRows(rows, [], 'median')
    expect(out[0].mainDriver).toBe('review')
  })

  test('falls back to login when display name is empty', () => {
    const rows = [
      baseRow({ author: 'delta', authorDisplayName: '   ', number: 1 }),
    ]
    const out = computeAuthorRows(rows, [], 'median')
    expect(out[0].displayName).toBe('delta')
  })

  test('groups authors case-insensitively (login casing varies across PRs)', () => {
    const rows = [
      baseRow({
        author: 'Alpha',
        authorDisplayName: 'Alpha',
        number: 1,
        totalTime: 5,
      }),
      baseRow({
        author: 'alpha',
        authorDisplayName: 'Alpha',
        number: 2,
        totalTime: 7,
      }),
      baseRow({
        author: 'ALPHA',
        authorDisplayName: 'Alpha',
        number: 3,
        totalTime: 9,
      }),
    ]
    const prev = [
      baseRow({ author: 'Alpha', number: 11, totalTime: 10 }),
      baseRow({ author: 'alpha', number: 12, totalTime: 12 }),
    ]
    const out = computeAuthorRows(rows, prev, 'median')
    expect(out).toHaveLength(1)
    expect(out[0].prCount).toBe(3)
    expect(out[0].total).toBe(7)
    // Previous-period rows with the same login (different casing) must be
    // matched and produce a non-null delta.
    expect(out[0].changeVsPrev.diff).not.toBeNull()
  })
})

describe('computeLongestPrs', () => {
  test('sorts by totalTime desc and keeps limit', () => {
    const rows = [
      baseRow({ number: 1, totalTime: 5 }),
      baseRow({ number: 2, totalTime: 12 }),
      baseRow({ number: 3, totalTime: 8 }),
    ]
    const out = computeLongestPrs(rows, 2)
    expect(out.map((r) => r.number)).toEqual([2, 3])
  })

  test('bottleneck is the largest stage', () => {
    const rows = [
      baseRow({
        number: 1,
        codingTime: 1,
        pickupTime: 0.5,
        reviewTime: 7,
        deployTime: 1,
        totalTime: 9.5,
      }),
    ]
    expect(computeLongestPrs(rows)[0].bottleneck).toBe('review')
  })

  test('PR with all-null stages has bottleneck null', () => {
    const rows = [
      baseRow({
        number: 1,
        codingTime: null,
        pickupTime: null,
        reviewTime: null,
        deployTime: null,
        totalTime: 3,
      }),
    ]
    expect(computeLongestPrs(rows)[0].bottleneck).toBeNull()
  })

  test('skips rows without totalTime or releasedAt', () => {
    const rows = [
      baseRow({ number: 1, totalTime: null }),
      baseRow({ number: 2, totalTime: 5, releasedAt: null }),
      baseRow({ number: 3, totalTime: 6 }),
    ]
    const out = computeLongestPrs(rows)
    expect(out.map((r) => r.number)).toEqual([3])
  })
})

describe('computeInsights', () => {
  const mode = 'median' as const

  test('caps to 3 entries', () => {
    const rows = [
      baseRow({
        number: 1,
        codingTime: 1,
        pickupTime: 1,
        reviewTime: 5,
        deployTime: 1,
        totalTime: 8,
      }),
      baseRow({
        number: 2,
        codingTime: 1,
        pickupTime: 1,
        reviewTime: 5,
        deployTime: 1,
        totalTime: 8,
      }),
    ]
    const prev = [
      baseRow({
        number: 11,
        codingTime: 1,
        pickupTime: 5,
        reviewTime: 1,
        deployTime: 1,
        totalTime: 8,
      }),
    ]
    const weekly = [
      {
        weekStart: 'a',
        weekLabel: 'a',
        prCount: 2,
        coding: 1,
        pickup: 1,
        review: 5,
        deploy: 1,
        total: 8,
      },
      {
        weekStart: 'b',
        weekLabel: 'b',
        prCount: 0,
        coding: null,
        pickup: null,
        review: null,
        deploy: 4,
        total: null,
      },
      {
        weekStart: 'c',
        weekLabel: 'c',
        prCount: 0,
        coding: null,
        pickup: null,
        review: null,
        deploy: 1,
        total: null,
      },
    ]
    const mix = computeBottleneckMix(rows, mode)
    const prevMix = computeBottleneckMix(prev, mode)
    const out = computeInsights({
      current: rows,
      previous: prev,
      weekly,
      mix,
      prevMix,
      mode,
    })
    expect(out.length).toBeLessThanOrEqual(3)
  })

  test('returns review-dominance string when review is the largest stage', () => {
    const rows = [
      baseRow({
        number: 1,
        codingTime: 1,
        pickupTime: 1,
        reviewTime: 6,
        deployTime: 1,
        totalTime: 9,
      }),
    ]
    const prev = [
      baseRow({
        number: 11,
        codingTime: 1,
        pickupTime: 1,
        reviewTime: 3,
        deployTime: 1,
        totalTime: 6,
      }),
    ]
    const mix = computeBottleneckMix(rows, mode)
    const prevMix = computeBottleneckMix(prev, mode)
    const out = computeInsights({
      current: rows,
      previous: prev,
      weekly: [],
      mix,
      prevMix,
      mode,
    })
    expect(out[0]).toMatch(/^Review time is the main driver/)
  })

  test('main driver follows the actual largest stage (not hardcoded review)', () => {
    // Pickup is dominant (61%), review is 36%. The first insight must be
    // about Pickup, not Review.
    const rows = [
      baseRow({
        number: 1,
        codingTime: 0.05,
        pickupTime: 0.2,
        reviewTime: 0.12,
        deployTime: 0,
        totalTime: 0.37,
      }),
    ]
    const prev = [
      baseRow({
        number: 11,
        codingTime: 0.05,
        pickupTime: 0.25,
        reviewTime: 0.12,
        deployTime: 0,
        totalTime: 0.42,
      }),
    ]
    const mix = computeBottleneckMix(rows, mode)
    const prevMix = computeBottleneckMix(prev, mode)
    const out = computeInsights({
      current: rows,
      previous: prev,
      weekly: [],
      mix,
      prevMix,
      mode,
    })
    expect(out[0]).toMatch(/^Pickup time is the main driver/)
    // No insight should claim Review is the main driver in this scenario.
    expect(out.some((s) => /Review time is the main driver/.test(s))).toBe(
      false,
    )
  })

  test('improvement insight only fires for non-dominant stages', () => {
    // Pickup is dominant AND improved. Improvement message must not appear
    // separately — the dominant insight already speaks to the change.
    const rows = [
      baseRow({
        number: 1,
        codingTime: 0.1,
        pickupTime: 0.5,
        reviewTime: 0.1,
        deployTime: 0.1,
        totalTime: 0.8,
      }),
    ]
    const prev = [
      baseRow({
        number: 11,
        codingTime: 0.1,
        pickupTime: 1.0,
        reviewTime: 0.1,
        deployTime: 0.1,
        totalTime: 1.3,
      }),
    ]
    const mix = computeBottleneckMix(rows, mode)
    const prevMix = computeBottleneckMix(prev, mode)
    const out = computeInsights({
      current: rows,
      previous: prev,
      weekly: [],
      mix,
      prevMix,
      mode,
    })
    expect(out.filter((s) => /^Pickup time/.test(s))).toHaveLength(1)
  })

  test('empty current period returns []', () => {
    const out = computeInsights({
      current: [],
      previous: [],
      weekly: [],
      mix: computeBottleneckMix([], mode),
      prevMix: computeBottleneckMix([], mode),
      mode,
    })
    expect(out).toEqual([])
  })
})
