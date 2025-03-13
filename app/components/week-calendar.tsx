import { addDays, isSameDay, isWithinInterval, startOfDay } from 'date-fns'
import { ja } from 'date-fns/locale'
import { useEffect, useRef, useState } from 'react'
import { useDayRender, type DayProps } from 'react-day-picker'
import { Calendar } from '~/app/components/ui'
import { cn } from '../libs/utils'

// 曜日の設定
const WEEKDAYS = [
  { value: '6', label: '土曜日' },
  { value: '0', label: '日曜日' },
  { value: '1', label: '月曜日' },
  { value: '2', label: '火曜日' },
  { value: '3', label: '水曜日' },
  { value: '4', label: '木曜日' },
  { value: '5', label: '金曜日' },
]

// 指定された開始曜日に基づく週間間隔を取得
const getWeekInterval = (date: Date, startOfWeekDay: number) => {
  const normalizedDate = startOfDay(date) // 00:00 に設定
  const dayOfWeek = normalizedDate.getDay()

  // 選択された開始曜日に合わせて調整
  let diff = dayOfWeek - startOfWeekDay
  if (diff < 0) diff += 7

  const start = addDays(normalizedDate, -diff) // 開始曜日に調整
  const end = addDays(start, 6) // 7日間の終了日

  return { start, end }
}

interface WeeklyCalendarProps {
  onWeekChange?: (start: Date, end: Date) => void
  initialDate?: Date
  startDay?: number // 初期の週開始曜日 (0-6)
}

const WeeklyCalendar = ({
  onWeekChange,
  initialDate = new Date(),
  startDay = 6, // デフォルトは土曜日
}: WeeklyCalendarProps) => {
  const [selectedDate, setSelectedDate] = useState<Date>(initialDate)
  const [weekInterval, setWeekInterval] = useState(
    getWeekInterval(initialDate, startDay),
  )

  useEffect(() => {
    const interval = getWeekInterval(selectedDate, startDay)
    setWeekInterval(interval)
    if (onWeekChange) {
      onWeekChange(interval.start, interval.end)
    }
  }, [selectedDate, startDay, onWeekChange])

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date)
    }
  }

  // カレンダーのカスタム日付レンダリング
  const DayComponent = ({ date, displayMonth }: DayProps) => {
    // biome-ignore lint/style/noNonNullAssertion: <explanation>
    const buttonRef = useRef<HTMLButtonElement>(null!)
    const dayRender = useDayRender(date, displayMonth, buttonRef)

    const isSelected = isWithinInterval(date, {
      start: weekInterval.start,
      end: weekInterval.end,
    })
    const isWeekStart = isSameDay(date, weekInterval.start)
    const isWeekEnd = isSameDay(date, weekInterval.end)

    // biome-ignore lint/a11y/useFocusableInteractive: <explanation>
    if (dayRender.isHidden) return <div role="gridcell" />
    if (!dayRender.isButton) return <div {...dayRender.divProps} />

    const { className, ...rest } = dayRender.buttonProps
    return (
      <button
        name="day"
        ref={buttonRef}
        className={cn(
          className,
          isSelected
            ? 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground rounded-none'
            : '',
          isWeekStart ? 'rounded-l-lg' : '',
          isWeekEnd ? 'rounded-r-lg' : '',
        )}
        {...rest}
      />
    )
  }

  return (
    <Calendar
      mode="single"
      selected={selectedDate}
      onSelect={handleDateSelect}
      weekStartsOn={startDay as 0 | 1 | 2 | 3 | 4 | 5 | 6}
      locale={ja}
      components={{
        Day: DayComponent,
      }}
      className="rounded-lg border p-3"
    />
  )
}

export default WeeklyCalendar
