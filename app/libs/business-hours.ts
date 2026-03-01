import holidayJp from '@holiday-jp/holiday_jp'
import dayjs from '~/app/libs/dayjs'

/**
 * Check if a given date (year, month 0-indexed, date) falls on a weekday (Mon-Fri).
 */
const isWeekday = (year: number, month: number, date: number): boolean => {
  const day = new Date(year, month, date).getDay()
  return day !== 0 && day !== 6
}

/**
 * Count weekdays (Mon-Fri) between two dates (inclusive of startDate, exclusive of endDate).
 * Uses week-based arithmetic instead of day-by-day loop: O(1) instead of O(n).
 */
const countWeekdays = (
  startDate: dayjs.Dayjs,
  endDate: dayjs.Dayjs,
): number => {
  const totalDays = endDate.startOf('day').diff(startDate.startOf('day'), 'day')
  if (totalDays <= 0) return 0

  const fullWeeks = Math.floor(totalDays / 7)
  const remainingDays = totalDays % 7

  let weekdays = fullWeeks * 5

  // Count weekdays in the remaining partial week
  const startDay = startDate.day() // 0=Sun, 1=Mon, ..., 6=Sat
  for (let i = 0; i < remainingDays; i++) {
    const day = (startDay + i) % 7
    if (day !== 0 && day !== 6) {
      weekdays++
    }
  }

  return weekdays
}

/**
 * Count holidays from @holiday-jp that fall on weekdays within the date range.
 * Uses holiday_jp.between() which returns holidays in the range efficiently.
 */
const countWeekdayHolidays = (
  startDate: dayjs.Dayjs,
  endDate: dayjs.Dayjs,
): number => {
  const from = new Date(startDate.year(), startDate.month(), startDate.date())
  const to = new Date(endDate.year(), endDate.month(), endDate.date())

  // holiday_jp.between returns holidays in [from, to] inclusive
  const holidays = holidayJp.between(from, to)

  let count = 0
  for (const holiday of holidays) {
    const d = holiday.date
    if (isWeekday(d.getFullYear(), d.getMonth(), d.getDate())) {
      count++
    }
  }
  return count
}

/**
 * 2つの日時間の営業時間を計算する（土日・日本の祝日を除外）
 *
 * Optimized: uses week-based weekday counting O(1) + holiday filtering O(holidays)
 * instead of day-by-day iteration O(days).
 */
export const calculateBusinessHours = (
  start: string,
  end: string,
  timezone = 'Asia/Tokyo',
): number => {
  const startDate = dayjs(start).tz(timezone)
  const endDate = dayjs(end).tz(timezone)

  if (!startDate.isBefore(endDate)) return 0

  const startOfFirstDay = startDate.startOf('day')
  const startOfLastDay = endDate.startOf('day')

  // For same-day case
  if (startOfFirstDay.isSame(startOfLastDay)) {
    const dayOfWeek = startDate.day()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
    const isHoliday = holidayJp.isHoliday(
      new Date(startDate.year(), startDate.month(), startDate.date()),
    )
    if (isWeekend || isHoliday) return 0
    return endDate.diff(startDate, 'hour', true)
  }

  let totalHours = 0

  // 1. Partial first day: startDate -> end of first day
  const firstDayEnd = startDate.endOf('day')
  const firstDayOfWeek = startDate.day()
  const firstDayIsWeekend = firstDayOfWeek === 0 || firstDayOfWeek === 6
  const firstDayIsHoliday = holidayJp.isHoliday(
    new Date(startDate.year(), startDate.month(), startDate.date()),
  )
  if (!firstDayIsWeekend && !firstDayIsHoliday) {
    totalHours += firstDayEnd.diff(startDate, 'hour', true)
  }

  // 2. Full days in between: day after first day -> day before last day
  const secondDay = startOfFirstDay.add(1, 'day')
  if (secondDay.isBefore(startOfLastDay)) {
    const fullWeekdays = countWeekdays(secondDay, startOfLastDay)
    const holidaysInRange = countWeekdayHolidays(
      secondDay,
      startOfLastDay.subtract(1, 'day'),
    )
    totalHours += (fullWeekdays - holidaysInRange) * 24
  }

  // 3. Partial last day: start of last day -> endDate
  const lastDayOfWeek = endDate.day()
  const lastDayIsWeekend = lastDayOfWeek === 0 || lastDayOfWeek === 6
  const lastDayIsHoliday = holidayJp.isHoliday(
    new Date(endDate.year(), endDate.month(), endDate.date()),
  )
  if (!lastDayIsWeekend && !lastDayIsHoliday) {
    totalHours += endDate.diff(startOfLastDay, 'hour', true)
  }

  return totalHours
}
