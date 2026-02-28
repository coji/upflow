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
  const startTime = dayjs(start)
  const endTime = dayjs(end)

  let current = startTime.startOf('day')
  const endDay = endTime.startOf('day')
  let businessDays = 0

  // 開始日から終了日の前日まで、平日をカウント
  while (current.isBefore(endDay)) {
    if (current.weekday() !== 0 && current.weekday() !== 6) {
      businessDays++
    }
    current = current.add(1, 'day')
  }

  // 開始日の端数を引く（平日の場合）
  if (startTime.weekday() !== 0 && startTime.weekday() !== 6) {
    const startDayElapsed = startTime.diff(
      startTime.startOf('day'),
      'hour',
      true,
    )
    businessDays -= startDayElapsed / 24
  }

  // 終了日の端数を足す（平日の場合）
  if (endTime.weekday() !== 0 && endTime.weekday() !== 6) {
    const endDayElapsed = endTime.diff(endDay, 'hour', true)
    businessDays += endDayElapsed / 24
  }

  return businessDays * 24
}
