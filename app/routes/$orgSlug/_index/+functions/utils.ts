import dayjs from '~/app/libs/dayjs'

export const parseDate = (date: string | null, timeZone = 'Asia/Tokyo') => {
  const dt = date ? dayjs(date, 'YYYY-MM-DD') : dayjs()
  return dt.tz(timeZone).startOf('day')
}

export function getStartOfWeek(now = new Date(), timezone = 'Asia/Tokyo') {
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

export function getEndOfWeek(now = new Date(), timezone = 'Asia/Tokyo') {
  const startOfWeek = getStartOfWeek(now, timezone)
  return startOfWeek.add(7, 'day').subtract(1, 'second')
}

export { calculateBusinessHours } from '~/app/libs/business-hours'
