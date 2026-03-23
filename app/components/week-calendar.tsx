import holiday_jp from '@holiday-jp/holiday_jp'
import { ja } from 'date-fns/locale'
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import * as React from 'react'
import { useMemo } from 'react'
import type { DayButton } from 'react-day-picker'
import {
  Button,
  Calendar,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/app/components/ui'
import { useTimezone } from '~/app/hooks/use-timezone'
import dayjs from '~/app/libs/dayjs'
import { cn } from '~/app/libs/utils'

interface WeekInterval {
  start: Date
  end: Date
}

/**
 * Calculate the week interval (start – end) containing the given date,
 * based on the specified week-start day (0=Sun … 6=Sat, default 1=Mon).
 *
 * `timeZone` must match org/report timezone (see loaders using `timezoneContext`).
 * Without it, SSR (often UTC) and the browser (e.g. JST) disagree on calendar day
 * around week boundaries — e.g. Monday 00:00 JST is still Sunday in UTC.
 */
export const getWeekInterval = (
  date: Date,
  startOfWeekDay: number,
  timeZone: string,
): WeekInterval => {
  const normalizedDate = dayjs(date).tz(timeZone).startOf('day')
  const dayOfWeek = normalizedDate.day()

  let diff = dayOfWeek - startOfWeekDay
  if (diff < 0) diff += 7

  const start = normalizedDate.subtract(diff, 'day')
  const end = start.add(6, 'day')

  return { start: start.toDate(), end: end.toDate() }
}

/**
 * Custom day button that highlights the entire selected week.
 * Extracted to module scope to maintain a stable component identity.
 */
function WeekDayButton({
  className,
  day,
  modifiers,
  weekInterval,
  timeZone,
  ...props
}: React.ComponentProps<typeof DayButton> & {
  weekInterval: WeekInterval
  timeZone: string
}) {
  const targetDate = dayjs(day.date).tz(timeZone).startOf('day')
  const weekStart = dayjs(weekInterval.start).tz(timeZone).startOf('day')
  const weekEnd = dayjs(weekInterval.end).tz(timeZone).startOf('day')
  const isSelected = targetDate.isBetween(weekStart, weekEnd, 'day', '[]')
  const isWeekStart = targetDate.isSame(weekStart, 'day')
  const isWeekEnd = targetDate.isSame(weekEnd, 'day')

  const dayOfWeek = targetDate.day()
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
  const isHoliday = holiday_jp.isHoliday(targetDate.format('YYYY-MM-DD'))

  const ref = React.useRef<HTMLButtonElement>(null)
  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus()
  }, [modifiers.focused])

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      data-day={targetDate.format('YYYY-MM-DD')}
      data-selected={isSelected}
      className={cn(
        className,
        !isSelected && isHoliday && 'text-red-500',
        !isSelected && isWeekend && !isHoliday && 'text-muted-foreground/50',
        isSelected &&
          'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground rounded-none',
        isWeekStart && 'rounded-l-lg',
        isWeekEnd && 'rounded-r-lg',
      )}
      {...props}
    />
  )
}

interface WeeklyCalendarProps {
  /** Any date within the week to display (Date or ISO string). The component derives the full week from this. */
  value: Date | string
  /** Called with the new week-start date when the user navigates to a different week. */
  onWeekChange: (start: Date) => void
  /** Week start day: 0=Sunday … 6=Saturday. Defaults to 1 (Monday). */
  startDay?: 0 | 1 | 2 | 3 | 4 | 5 | 6
}

/**
 * Controlled week picker with prev/next navigation and calendar popover.
 *
 * The parent owns the week state (typically via URL search params).
 * This component is stateless regarding the selected week — it derives
 * the display from `value` and notifies changes via `onWeekChange`.
 */
const WeeklyCalendar = ({
  value,
  onWeekChange,
  startDay = 1,
}: WeeklyCalendarProps) => {
  const [open, setOpen] = React.useState(false)
  const timeZone = useTimezone()

  // Convert to Date once, then derive a stable primitive key so useMemo
  // doesn't re-run when the parent passes a new Date with the same timestamp.
  const valueDate = value instanceof Date ? value : new Date(value)
  const valueMs = valueDate.getTime()
  const weekInterval = useMemo(
    () => getWeekInterval(new Date(valueMs), startDay, timeZone),
    [valueMs, startDay, timeZone],
  )

  const navigateTo = (date: Date) => {
    const { start } = getWeekInterval(date, startDay, timeZone)
    onWeekChange(start)
  }

  const handlePrevWeek = () => {
    navigateTo(dayjs(weekInterval.start).subtract(7, 'day').toDate())
  }

  const handleNextWeek = () => {
    navigateTo(dayjs(weekInterval.start).add(7, 'day').toDate())
  }

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      navigateTo(date)
    }
    setOpen(false)
  }

  const today = dayjs().tz(timeZone).startOf('day')
  const weekStart = dayjs(weekInterval.start).tz(timeZone).startOf('day')
  const weekEnd = dayjs(weekInterval.end).tz(timeZone).startOf('day')
  const isCurrentWeek = today.isBetween(weekStart, weekEnd, 'day', '[]')

  const formatWeekLabel = () => {
    const start = dayjs(weekInterval.start).tz(timeZone)
    const end = dayjs(weekInterval.end).tz(timeZone)
    return `${start.format('M/D')} – ${end.format('M/D')}`
  }

  // Bind weekInterval to the module-scope WeekDayButton via a stable wrapper.
  // Re-creates only when weekInterval changes (user navigates weeks).
  const BoundWeekDayButton = useMemo(() => {
    return function BoundWeekDayButton(
      props: React.ComponentProps<typeof DayButton>,
    ) {
      return (
        <WeekDayButton
          {...props}
          weekInterval={weekInterval}
          timeZone={timeZone}
        />
      )
    }
  }, [weekInterval, timeZone])

  const calendarComponents = useMemo(
    () => ({ DayButton: BoundWeekDayButton }),
    [BoundWeekDayButton],
  )

  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="ghost"
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
            selected={weekInterval.start}
            defaultMonth={weekInterval.start}
            onSelect={handleDateSelect}
            weekStartsOn={startDay}
            locale={ja}
            components={calendarComponents}
            className="p-1"
          />
          {!isCurrentWeek && (
            <div className="border-t p-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={() => {
                  navigateTo(new Date())
                  setOpen(false)
                }}
              >
                今週に戻る
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={handleNextWeek}
        aria-label="Next week"
      >
        <ChevronRightIcon className="h-4 w-4" />
      </Button>
    </div>
  )
}

export default WeeklyCalendar
