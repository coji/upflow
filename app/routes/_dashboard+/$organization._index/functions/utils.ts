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

// 2つの日時間の時間を計算する関数（土日を除外）
export const calculateBusinessHours = (
  start: string,
  end: string,
  timezone = 'Asia/Tokyo',
): number => {
  // 開始/終了日時をタイムゾーンを考慮して解析
  let startDate = dayjs(start).tz(timezone)
  const endDate = dayjs(end).tz(timezone)

  let totalHours = 0

  // 1日ずつ進めて計算
  while (startDate.isBefore(endDate)) {
    // 現在の日の終わり (23:59:59)
    const dayEnd = startDate.endOf('day')

    // 今日の終わりか終了日時の早い方
    const currentEnd = dayEnd.isBefore(endDate) ? dayEnd : endDate

    // 土日を除外 (day() === 0 は日曜日、6 は土曜日)
    const dayOfWeek = startDate.day()
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      totalHours += currentEnd.diff(startDate, 'hour', true)
    }

    // 翌日の0時に設定
    startDate = startDate.add(1, 'day').startOf('day')
  }

  return totalHours
}
