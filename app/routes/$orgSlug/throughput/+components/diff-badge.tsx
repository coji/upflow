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
  const diff = value - prevValue
  if (diff === 0) return null
  const isPositive = invertColor ? diff < 0 : diff > 0
  return (
    <span
      className={cn(
        'text-xs font-medium',
        isPositive ? 'text-emerald-600' : 'text-red-500',
      )}
    >
      {format(diff)}
    </span>
  )
}
