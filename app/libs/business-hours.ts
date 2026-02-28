import holidayJp from '@holiday-jp/holiday_jp'
import dayjs from '~/app/libs/dayjs'

/**
 * 2つの日時間の営業時間を計算する（土日・日本の祝日を除外）
 */
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

    // 土日・祝日を除外
    const dayOfWeek = startDate.day()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
    const isHoliday = holidayJp.isHoliday(
      new Date(startDate.year(), startDate.month(), startDate.date()),
    )
    if (!isWeekend && !isHoliday) {
      totalHours += currentEnd.diff(startDate, 'hour', true)
    }

    // 翌日の0時に設定
    startDate = startDate.add(1, 'day').startOf('day')
  }

  return totalHours
}
