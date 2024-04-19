import dayjs from '~/app/libs/dayjs'

export function getStartOfWeek() {
  // 現在の日付
  const today = dayjs()
  // 今週の月曜日を取得
  const monday = today.weekday(1)

  return monday.format('YYYY-MM-DD')
}
