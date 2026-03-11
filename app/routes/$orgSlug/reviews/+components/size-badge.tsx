import { Badge } from '~/app/components/ui'
import { getPRComplexity, type PRSizeLabel } from '../+functions/classify'

const sizeStyle: Record<PRSizeLabel, string> = {
  XS: 'bg-[var(--color-chart-2)]/60 text-white hover:bg-[var(--color-chart-2)]/40',
  S: 'bg-[var(--color-chart-2)] text-white hover:bg-[var(--color-chart-2)]/80',
  M: 'bg-[var(--color-chart-1)] text-white hover:bg-[var(--color-chart-1)]/80',
  L: 'bg-[var(--color-chart-4)] text-white hover:bg-[var(--color-chart-4)]/80',
  XL: 'bg-destructive text-destructive-foreground hover:bg-destructive/80',
  Unclassified: '',
}

export function SizeBadge({ complexity }: { complexity: string | null }) {
  const label = getPRComplexity({ complexity })
  if (label === 'Unclassified') return null
  return <Badge className={`text-xs ${sizeStyle[label]}`}>{label}</Badge>
}
