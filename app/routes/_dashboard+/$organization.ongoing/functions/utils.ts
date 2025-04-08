import dayjs from '~/app/libs/dayjs'

export function getStartOfWeek(timezone = 'Asia/Tokyo') {
  // 現在の日付
  const today = dayjs().utc().tz(timezone)
  // 今週の月曜日を取得
  const monday = today.weekday(1).startOf('day')

  return monday
}

// 2つの日時間の時間を計算する関数（土日を除外）
export const calculateBusinessHours = (start: string, end: string): number => {
  let startTime = dayjs(start)
  const endTime = dayjs(end)
  let totalHours = 0

  // 開始日から終了日までループ
  while (startTime.isBefore(endTime)) {
    // 土日を除外
    if (startTime.weekday() !== 0 && startTime.weekday() !== 6) {
      totalHours += 24 // 1日を時間で加算（必要に応じて調整）
    }
    startTime = startTime.add(1, 'day') // 次の日に進む
  }

  // 最終日の時間も計算する（終了時刻がその日のうちなら）
  if (endTime.weekday() !== 0 && endTime.weekday() !== 6) {
    const hoursLastDay = endTime.diff(endTime.startOf('day'), 'hour')
    totalHours += hoursLastDay
  }

  return totalHours
}
