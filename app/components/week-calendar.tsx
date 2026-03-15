import { ja } from 'date-fns/locale'
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import * as React from 'react'
import { useState } from 'react'
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

/**
 * Calculate the week interval (start Monday – end Sunday) containing
 * the given date, based on the specified week-start day.
 */
const getWeekInterval = (date: Date, startOfWeekDay: number) => {
  const normalizedDate = dayjs(date).startOf('day')
  const dayOfWeek = normalizedDate.day()

  let diff = dayOfWeek - startOfWeekDay
  if (diff < 0) diff += 7

  const start = normalizedDate.subtract(diff, 'day')
  const end = start.add(6, 'day')

  return { start: start.toDate(), end: end.toDate() }
}

interface WeeklyCalendarProps {
  onWeekChange?: (start: Date, end: Date) => void
  initialDate?: Date
  startDay?: 0 | 1 | 2 | 3 | 4 | 5 | 6
}

const WeeklyCalendar = ({
  onWeekChange,
  initialDate = new Date(),
  startDay = 1,
}: WeeklyCalendarProps) => {
  const [open, setOpen] = useState(false)
  const [weekInterval, setWeekInterval] = useState(() =>
    getWeekInterval(initialDate, startDay),
  )

  const changeWeek = (newDate: Date) => {
    const interval = getWeekInterval(newDate, startDay)
    setWeekInterval(interval)
    onWeekChange?.(interval.start, interval.end)
  }

  const handlePrevWeek = () => {
    changeWeek(dayjs(weekInterval.start).subtract(7, 'day').toDate())
  }

  const handleNextWeek = () => {
    changeWeek(dayjs(weekInterval.start).add(7, 'day').toDate())
  }

  const handleToday = () => {
    changeWeek(new Date())
  }

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      changeWeek(date)
    }
    setOpen(false)
  }

  const isCurrentWeek = dayjs().isBetween(
    weekInterval.start,
    weekInterval.end,
    'day',
    '[]',
  )

  const formatWeekLabel = () => {
    const start = dayjs(weekInterval.start)
    const end = dayjs(weekInterval.end)
    if (start.year() !== end.year()) {
      return `${start.format('YYYY/M/D')} – ${end.format('YYYY/M/D')}`
    }
    if (start.month() !== end.month()) {
      return `${start.format('M/D')} – ${end.format('M/D')}`
    }
    return `${start.format('M/D')} – ${end.format('M/D')}`
  }

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
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={handlePrevWeek}
        aria-label="Previous week"
      >
        <ChevronLeftIcon className="h-4 w-4" />
      </Button>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-w-[140px] justify-center gap-1.5"
          >
            <CalendarIcon className="h-3.5 w-3.5" />
            {formatWeekLabel()}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">
          <Calendar
            mode="single"
            selected={dayjs(weekInterval.start).toDate()}
            defaultMonth={weekInterval.start}
            onSelect={handleDateSelect}
            weekStartsOn={startDay}
            locale={ja}
            components={{
              DayButton: WeekDayButton,
            }}
            className="rounded-lg border p-3"
          />
        </PopoverContent>
      </Popover>

      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={handleNextWeek}
        aria-label="Next week"
      >
        <ChevronRightIcon className="h-4 w-4" />
      </Button>

      {!isCurrentWeek && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleToday}
          className="text-muted-foreground text-xs"
        >
          Today
        </Button>
      )}
    </div>
  )
}

export default WeeklyCalendar
