import dayjs from '~/app/libs/dayjs'

export function getStartOfWeek(timezone = 'Asia/Tokyo') {
  // 現在の日付
  const today = dayjs().utc().tz(timezone)
  // 今週の月曜日を取得
  const monday = today.weekday(1).startOf('day')

  return monday
}

export { calculateBusinessHours } from '~/app/libs/business-hours'
