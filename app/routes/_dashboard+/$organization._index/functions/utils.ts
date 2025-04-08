import { TZDate } from '@date-fns/tz'
import {
  addDays,
  differenceInHours,
  isWeekend,
  parse,
  parseISO,
  subSeconds,
} from 'date-fns'

export const parseDate = (date: string | null, timeZone = 'Asia/Tokyo') => {
  const dt = date ? parse(date, 'yyyy-MM-dd', new Date()) : new Date()
  return new TZDate(dt.getFullYear(), dt.getMonth(), dt.getDate(), timeZone)
}

export function getStartOfWeek(now = new Date(), timezone = 'Asia/Tokyo') {
  const tzNow = new TZDate(now, timezone)

  // 今日の日付 (00:00:00)
  const today = new TZDate(
    tzNow.getFullYear(),
    tzNow.getMonth(),
    tzNow.getDate(),
    timezone,
  )

  // 今週の月曜日を取得
  const dayOfWeek = today.getDay()
  if (dayOfWeek === 1) {
    // 今日が月曜日の場合
    return today
  }
  if (dayOfWeek === 0) {
    // 今日が日曜日の場合は6日前
    return addDays(today, -6)
  }
  // それ以外の場合は、今週の月曜日を取得 (dayOfWeek=2なら1日前、3なら2日前...)
  return addDays(today, -(dayOfWeek - 1))
}

export function getEndOfWeek(now = new Date(), timezone = 'Asia/Tokyo') {
  const startOfWeek = getStartOfWeek(now, timezone)
  return subSeconds(addDays(startOfWeek, 7), 1)
}

// 2つの日時間の時間を計算する関数（土日を除外）
export const calculateBusinessHours = (
  start: string,
  end: string,
  timezone = 'Asia/Tokyo',
): number => {
  // 開始/終了日時をタイムゾーンを考慮して解析
  let startDate = new TZDate(parseISO(start), timezone)
  const endDate = new TZDate(parseISO(end), timezone)

  let totalHours = 0

  // 1日ずつ進めて計算
  while (startDate < endDate) {
    // 現在の日の終わり (23:59:59)
    const dayEnd = new TZDate(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate(),
      23,
      59,
      59,
      timezone,
    )

    // 今日の終わりか終了日時の早い方
    const currentEnd = dayEnd < endDate ? dayEnd : endDate

    // 土日を除外
    if (!isWeekend(startDate)) {
      totalHours += differenceInHours(currentEnd, startDate)

      // 23:59:59 → 24:00:00の場合、1分を加算
      if (currentEnd.getHours() === 23 && currentEnd.getMinutes() === 59) {
        totalHours += 1 / 60
      }
    }

    // 翌日の0時に設定
    startDate = new TZDate(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate() + 1,
      0,
      0,
      0,
      timezone,
    )
  }

  return totalHours
}
