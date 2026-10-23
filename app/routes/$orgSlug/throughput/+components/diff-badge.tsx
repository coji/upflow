import { cn } from '~/app/libs/utils'

export function DiffBadge({
  value,
  prevValue,
  format = (v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}`,
  invertColor = false,
}: {
  value: number
  prevValue: number | null
  format?: (diff: number) => string
  invertColor?: boolean
}) {
  if (prevValue === null) return null
  // Round to the displayed precision so a change that shows as "+0.0" is
  // treated as no change instead of being colored as better or worse.
  const diff = Math.round((value - prevValue) * 10) / 10
  if (diff === 0) return null
  const isPositive = invertColor ? diff < 0 : diff > 0
  return (
    <span
      className={cn(
        'text-xs font-medium',
        isPositive
          ? 'text-emerald-600 dark:text-emerald-400'
          : 'text-red-600 dark:text-red-400',
      )}
    >
      {format(diff)}
    </span>
  )
}
