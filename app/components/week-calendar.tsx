import { addDays, isSameDay, isWithinInterval, startOfDay } from 'date-fns'
import { ja } from 'date-fns/locale'
import { useEffect, useRef, useState } from 'react'
import { useDayRender, type DayProps } from 'react-day-picker'
import {
  Button,
  Calendar,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/app/components/ui'
import { cn } from '../libs/utils'

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
  startDay?: 0 | 1 | 2 | 3 | 4 | 5 | 6 // 初期の週開始曜日 (0: Sunday - 6: Saturday)
}

const WeeklyCalendar = ({
  onWeekChange,
  initialDate = new Date(),
  startDay = 1, // デフォルトは月曜日
}: WeeklyCalendarProps) => {
  const [open, setOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date>(initialDate)
  const [weekInterval, setWeekInterval] = useState(
    getWeekInterval(initialDate, startDay),
  )

  useEffect(() => {
    const interval = getWeekInterval(selectedDate, startDay)
    if (!isSameDay(interval.start, weekInterval.start)) {
      setWeekInterval(interval)
      if (onWeekChange) {
        onWeekChange(interval.start, interval.end)
      }
    }
  }, [selectedDate, startDay, weekInterval.start, onWeekChange])

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date)
    }
    setOpen(false)
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
    if (dayRender.isHidden) return <div role="gridcell" aria-hidden="true" />
    if (!dayRender.isButton) return <div {...dayRender.divProps} />

    const { className, ...rest } = dayRender.buttonProps
    return (
      <button
        name="day"
        ref={buttonRef}
        className={cn(
          className,
          isSelected &&
            'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground aria-selected:text-primary-foreground rounded-none',
          isWeekStart && 'rounded-l-lg',
          isWeekEnd && 'rounded-r-lg',
        )}
        {...rest}
      />
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          週を選択
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <div>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleDateSelect}
            weekStartsOn={startDay}
            locale={ja}
            components={{
              Day: DayComponent,
            }}
            className="rounded-lg border p-3"
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}

export default WeeklyCalendar
