import { ja } from 'date-fns/locale'
import * as React from 'react'
import { useEffect, useState } from 'react'
import type { DayButton } from 'react-day-picker'
import {
  Button,
  Calendar,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/app/components/ui'
import dayjs from '~/app/libs/dayjs'
import { cn } from '../libs/utils'

// 指定された開始曜日に基づく週間間隔を取得
const getWeekInterval = (date: Date, startOfWeekDay: number) => {
  const normalizedDate = dayjs(date).startOf('day')
  const dayOfWeek = normalizedDate.day()

  // 選択された開始曜日に合わせて調整
  let diff = dayOfWeek - startOfWeekDay
  if (diff < 0) diff += 7

  const start = normalizedDate.subtract(diff, 'day')
  const end = start.add(6, 'day')

  return { start: start.toDate(), end: end.toDate() }
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
    if (!dayjs(interval.start).isSame(weekInterval.start, 'day')) {
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
  function WeekDayButton({
    className,
    day,
    modifiers,
    ...props
  }: React.ComponentProps<typeof DayButton>) {
    const targetDate = dayjs(day.date)
    const isSelected = targetDate.isBetween(
      weekInterval.start,
      weekInterval.end,
      'day',
      '[]',
    )
    const isWeekStart = targetDate.isSame(weekInterval.start, 'day')
    const isWeekEnd = targetDate.isSame(weekInterval.end, 'day')

    const ref = React.useRef<HTMLButtonElement>(null)
    React.useEffect(() => {
      if (modifiers.focused) ref.current?.focus()
    }, [modifiers.focused])

    return (
      <Button
        ref={ref}
        variant="ghost"
        size="icon"
        data-day={day.date.toLocaleDateString()}
        data-selected={isSelected}
        className={cn(
          className,
          isSelected &&
            'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground rounded-none',
          isWeekStart && 'rounded-l-lg',
          isWeekEnd && 'rounded-r-lg',
        )}
        {...props}
      />
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          Select Week
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
              DayButton: WeekDayButton,
            }}
            className="rounded-lg border p-3"
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}

export default WeeklyCalendar
