import { describe, expect, test } from 'vitest'

import dayjs from '~/app/libs/dayjs'

import {
  aggregateWeeklyOpenPRInventory,
  isOpenAtSnapshot,
  type OpenPRInventoryRawRow,
} from './aggregate'

const baseRow = (
  overrides: Partial<OpenPRInventoryRawRow>,
): OpenPRInventoryRawRow => ({
  repositoryId: 'repo-1',
  number: 1,
  pullRequestCreatedAt: '2024-06-01T00:00:00.000Z',
  mergedAt: null,
  closedAt: null,
  firstReviewedAt: null,
  ...overrides,
})

describe('isOpenAtSnapshot', () => {
  test('mergedAt/closedAt exactly at snapshotAt are not open', () => {
    const snap = '2024-06-09T12:00:00.000Z'
    expect(
      isOpenAtSnapshot(
        baseRow({
          pullRequestCreatedAt: '2024-06-01T00:00:00.000Z',
          mergedAt: snap,
          closedAt: null,
        }),
        snap,
      ),
    ).toBe(false)
    expect(
      isOpenAtSnapshot(
        baseRow({
          pullRequestCreatedAt: '2024-06-01T00:00:00.000Z',
          mergedAt: null,
          closedAt: snap,
        }),
        snap,
      ),
    ).toBe(false)
  })
})

describe('aggregateWeeklyOpenPRInventory', () => {
  const tz = 'UTC'

  test('counts only PRs open at each week snapshot', () => {
    const snapshotSunday = '2024-06-09T23:59:59.999Z'
    const sinceDate = '2024-06-01T00:00:00.000Z'
    const now = snapshotSunday

    const rows: OpenPRInventoryRawRow[] = [
      baseRow({
        number: 1,
        pullRequestCreatedAt: '2024-06-08T12:00:00.000Z',
        mergedAt: null,
        closedAt: null,
      }),
      baseRow({
        number: 2,
        pullRequestCreatedAt: '2024-06-01T00:00:00.000Z',
        mergedAt: '2024-06-05T00:00:00.000Z',
        closedAt: null,
      }),
    ]

    const { weeks } = aggregateWeeklyOpenPRInventory(rows, sinceDate, now, tz)
    const w = weeks.find((x) => x.snapshotAt === snapshotSunday)
    expect(w?.total).toBe(1)
    expect(w?.days0to3).toBe(1)
  })

  test('bucket boundaries (age days)', () => {
    const snapshotSunday = '2024-06-09T23:59:59.999Z'
    const sinceDate = '2024-06-01T00:00:00.000Z'
    const now = snapshotSunday

    const cases: {
      age: number
      key: 'days0to3' | 'days4to7' | 'days8to14' | 'days15to30' | 'days31Plus'
    }[] = [
      { age: 3, key: 'days0to3' },
      { age: 4, key: 'days4to7' },
      { age: 7, key: 'days4to7' },
      { age: 8, key: 'days8to14' },
      { age: 14, key: 'days8to14' },
      { age: 15, key: 'days15to30' },
      { age: 30, key: 'days15to30' },
      { age: 31, key: 'days31Plus' },
    ]

    for (const { age, key } of cases) {
      const created = dayjs
        .utc(snapshotSunday)
        .tz(tz)
        .subtract(age, 'day')
        .toISOString()
      const { weeks } = aggregateWeeklyOpenPRInventory(
        [baseRow({ number: age, pullRequestCreatedAt: created })],
        sinceDate,
        now,
        tz,
      )
      const w = weeks.find((x) => x.snapshotAt === snapshotSunday)
      expect(w, `age ${age}`).toBeDefined()
      expect(w?.total, `age ${age}`).toBe(1)
      expect(w?.[key], `age ${age} bucket`).toBe(1)
      expect(
        (w?.days0to3 ?? 0) +
          (w?.days4to7 ?? 0) +
          (w?.days8to14 ?? 0) +
          (w?.days15to30 ?? 0) +
          (w?.days31Plus ?? 0),
      ).toBe(1)
    }
  })

  test('current incomplete week uses now as snapshot and counts at now', () => {
    const sinceDate = '2024-06-03T00:00:00.000Z'
    const now = '2024-06-05T15:00:00.000Z'
    const rows: OpenPRInventoryRawRow[] = [
      baseRow({
        pullRequestCreatedAt: '2024-06-03T10:00:00.000Z',
        mergedAt: null,
        closedAt: null,
      }),
    ]

    const { weeks } = aggregateWeeklyOpenPRInventory(rows, sinceDate, now, tz)
    expect(weeks).toHaveLength(1)
    expect(weeks[0]?.snapshotAt).toBe(now)
    expect(weeks[0]?.total).toBe(1)
  })

  test('empty rows still yields weeks with zeros', () => {
    const sinceDate = '2024-06-01T00:00:00.000Z'
    const now = '2024-06-15T12:00:00.000Z'
    const { weeks } = aggregateWeeklyOpenPRInventory([], sinceDate, now, tz)
    expect(weeks.length).toBeGreaterThan(0)
    for (const w of weeks) {
      expect(w.total).toBe(0)
    }
  })

  test('unreviewedOnly filters by snapshot-time review status', () => {
    const sinceDate = '2024-06-01T00:00:00.000Z'
    const now = '2024-06-16T23:59:59.999Z'
    // PR created Jun 3, reviewed on Jun 10
    const rows: OpenPRInventoryRawRow[] = [
      baseRow({
        number: 1,
        pullRequestCreatedAt: '2024-06-03T10:00:00.000Z',
        firstReviewedAt: '2024-06-10T12:00:00.000Z',
      }),
      // PR created Jun 5, never reviewed
      baseRow({
        number: 2,
        pullRequestCreatedAt: '2024-06-05T10:00:00.000Z',
        firstReviewedAt: null,
      }),
    ]

    const result = aggregateWeeklyOpenPRInventory(
      rows,
      sinceDate,
      now,
      tz,
      true, // unreviewedOnly
    )

    // Week of Jun 3 (snapshot Jun 9): PR#1 not yet reviewed → counted, PR#2 counted → total 2
    const week1 = result.weeks.find((w) => w.weekLabel === '06/03')
    expect(week1?.total).toBe(2)

    // Week of Jun 10 (snapshot Jun 16): PR#1 reviewed on Jun 10 ≤ snapshot → excluded, PR#2 counted → total 1
    const week2 = result.weeks.find((w) => w.weekLabel === '06/10')
    expect(week2?.total).toBe(1)
  })

  test('sinceDate after now yields empty weeks', () => {
    const { weeks } = aggregateWeeklyOpenPRInventory(
      [],
      '2025-01-01T00:00:00.000Z',
      '2024-01-01T00:00:00.000Z',
      tz,
    )
    expect(weeks).toEqual([])
  })
})
