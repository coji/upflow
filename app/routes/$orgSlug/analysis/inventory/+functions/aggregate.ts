import dayjs from '~/app/libs/dayjs'

export interface OpenPRInventoryRawRow {
  repositoryId: string
  number: number
  pullRequestCreatedAt: string
  mergedAt: string | null
  closedAt: string | null
  firstReviewedAt: string | null
}

export interface InventoryWeekPoint {
  weekLabel: string
  snapshotAt: string
  daysUnder1: number
  days1to3: number
  days3to7: number
  days7to14: number
  days14to30: number
  days31Plus: number
  total: number
}

export interface OpenPRInventoryAggregation {
  weeks: InventoryWeekPoint[]
}

function startOfWeekMonday(d: dayjs.Dayjs): dayjs.Dayjs {
  const day = d.day()
  const diffToMonday = day === 0 ? -6 : 1 - day
  return d.startOf('day').add(diffToMonday, 'day')
}

export function isOpenAtSnapshot(
  row: OpenPRInventoryRawRow,
  snapshotAt: string,
): boolean {
  if (row.pullRequestCreatedAt > snapshotAt) return false
  if (row.mergedAt !== null && row.mergedAt <= snapshotAt) return false
  if (row.closedAt !== null && row.closedAt <= snapshotAt) return false
  return true
}

function enumerateWeekStarts(
  sinceDate: string,
  now: string,
  timezone: string,
): dayjs.Dayjs[] {
  const since = dayjs.utc(sinceDate).tz(timezone)
  const nowTz = dayjs.utc(now).tz(timezone)

  if (since.isAfter(nowTz)) {
    return []
  }

  const firstMonday = startOfWeekMonday(since)
  const lastMonday = startOfWeekMonday(nowTz)

  const weeks: dayjs.Dayjs[] = []
  let cursor = firstMonday
  while (cursor.isBefore(lastMonday) || cursor.isSame(lastMonday, 'day')) {
    weeks.push(cursor)
    cursor = cursor.add(7, 'day')
  }
  return weeks
}

function getSnapshotAtForWeek(
  weekStart: dayjs.Dayjs,
  now: string,
  timezone: string,
): string {
  const nowTz = dayjs.utc(now).tz(timezone)
  const thisWeekMonday = startOfWeekMonday(nowTz)
  if (weekStart.isSame(thisWeekMonday, 'day')) {
    return now
  }
  return weekStart.add(6, 'day').endOf('day').utc().toISOString()
}

function addToBucket(point: InventoryWeekPoint, ageDays: number): void {
  point.total++
  if (ageDays < 1) point.daysUnder1++
  else if (ageDays < 3) point.days1to3++
  else if (ageDays < 7) point.days3to7++
  else if (ageDays < 14) point.days7to14++
  else if (ageDays < 30) point.days14to30++
  else point.days31Plus++
}

export function aggregateWeeklyOpenPRInventory(
  rows: OpenPRInventoryRawRow[],
  sinceDate: string,
  now: string,
  timezone: string,
  unreviewedOnly = false,
): OpenPRInventoryAggregation {
  const weekStarts = enumerateWeekStarts(sinceDate, now, timezone)

  return {
    weeks: weekStarts.map((weekStart) => {
      const snapshotAt = getSnapshotAtForWeek(weekStart, now, timezone)
      const point: InventoryWeekPoint = {
        weekLabel: weekStart.format('MM/DD'),
        snapshotAt,
        daysUnder1: 0,
        days1to3: 0,
        days3to7: 0,
        days7to14: 0,
        days14to30: 0,
        days31Plus: 0,
        total: 0,
      }

      const snapshotDayjs = dayjs.utc(snapshotAt)
      for (const row of rows) {
        if (!isOpenAtSnapshot(row, snapshotAt)) continue
        // unreviewedOnly: skip if PR was already reviewed before this snapshot
        if (
          unreviewedOnly &&
          row.firstReviewedAt !== null &&
          row.firstReviewedAt <= snapshotAt
        )
          continue

        const ageDays = snapshotDayjs.diff(
          dayjs.utc(row.pullRequestCreatedAt),
          'day',
        )

        addToBucket(point, ageDays)
      }

      return point
    }),
  }
}
