import { Badge } from '~/app/components/ui'
import { cn } from '~/app/libs/utils'
import { PR_SIZE_STYLE, getPRComplexity } from '../reviews/+functions/classify'

export function SizeBadge({ complexity }: { complexity: string | null }) {
  const label = getPRComplexity({ complexity })
  if (label === 'Unclassified') return null
  return <Badge className={cn('text-xs', PR_SIZE_STYLE[label])}>{label}</Badge>
}
