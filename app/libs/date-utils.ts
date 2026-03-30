import dayjs from '~/app/libs/dayjs'

/**
 * 組織タイムゾーン基準で N ヶ月前の日付境界を UTC ISO 文字列で返す。
 * 'all' の場合はエポック相当の固定値を返す。
 */
export function calcSinceDate(
  periodMonths: number | 'all',
  timezone: string,
): string {
  if (periodMonths === 'all') return '2000-01-01T00:00:00.000Z'
  return dayjs
    .utc()
    .tz(timezone)
    .subtract(periodMonths, 'month')
    .startOf('day')
    .utc()
    .toISOString()
}

export const parseDate = (date: string | null, timeZone: string) => {
  const dt = date ? dayjs(date, 'YYYY-MM-DD') : dayjs()
  return dt.tz(timeZone).startOf('day')
}

export function getStartOfWeek(now = new Date(), timezone: string) {
  const tzNow = dayjs(now).tz(timezone)

  // 今日の日付 (00:00:00)
  const today = tzNow.startOf('day')

  // 今週の月曜日を取得 (weekday(1) = 月曜日)
  // dayjsのweekdayプラグインでは、週の開始が日曜日(0)
  const dayOfWeek = today.day()
  if (dayOfWeek === 1) {
    // 今日が月曜日の場合
    return today
  }
  if (dayOfWeek === 0) {
    // 今日が日曜日の場合は6日前
    return today.subtract(6, 'day')
  }
  // それ以外の場合は、今週の月曜日を取得
  return today.subtract(dayOfWeek - 1, 'day')
}

export function getEndOfWeek(now = new Date(), timezone: string) {
  const startOfWeek = getStartOfWeek(now, timezone)
  return startOfWeek.add(7, 'day').subtract(1, 'second')
}
