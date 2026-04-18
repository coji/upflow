import { Badge } from '~/app/components/ui'
import { PR_SIZE_STYLE, getPRComplexity } from '~/app/libs/pr-classify'
import { cn } from '~/app/libs/utils'

export function SizeBadge({
  complexity,
  className,
}: {
  complexity: string | null
  className?: string
}) {
  const label = getPRComplexity({ complexity })
  if (label === 'Unclassified') return null
  return (
    <Badge className={cn('text-xs', PR_SIZE_STYLE[label], className)}>
      {label}
    </Badge>
  )
}
