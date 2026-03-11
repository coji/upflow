import { Badge } from '~/app/components/ui'
import { cn } from '~/app/libs/utils'
import {
  getPRComplexity,
  type PRSizeLabel,
} from '../reviews/+functions/classify'

const sizeStyle: Record<PRSizeLabel, string> = {
  XS: 'bg-[var(--color-chart-2)]/60 text-white',
  S: 'bg-[var(--color-chart-2)] text-white',
  M: 'bg-[var(--color-chart-1)] text-white',
  L: 'bg-[var(--color-chart-4)] text-white',
  XL: 'bg-destructive text-destructive-foreground',
  Unclassified: '',
}

export function SizeBadge({ complexity }: { complexity: string | null }) {
  const label = getPRComplexity({ complexity })
  if (label === 'Unclassified') return null
  return <Badge className={cn('text-xs', sizeStyle[label])}>{label}</Badge>
}
