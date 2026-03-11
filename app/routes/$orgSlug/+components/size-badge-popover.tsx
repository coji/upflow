import { CheckIcon, PencilIcon } from 'lucide-react'
import { useState } from 'react'
import { useFetcher, useParams } from 'react-router'
import { Badge } from '~/app/components/ui'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/app/components/ui/popover'
import { cn } from '~/app/libs/utils'
import {
  PR_SIZE_LABELS,
  PR_SIZE_STYLE,
  getPRComplexity,
  type PRSizeLabel,
} from '../reviews/+functions/classify'

function parseRiskAreas(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.map(String)
  } catch {
    // not JSON — split by comma
  }
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

interface SizeBadgePopoverProps {
  complexity: string | null
  complexityReason: string | null
  riskAreas: string | null
  correctedComplexity: string | null
  repositoryId: string
  number: number
}

export function SizeBadgePopover({
  complexity,
  complexityReason,
  riskAreas,
  correctedComplexity,
  repositoryId,
  number,
}: SizeBadgePopoverProps) {
  const { orgSlug } = useParams()
  const fetcher = useFetcher()
  const [open, setOpen] = useState(false)

  // Optimistic UI: fetcher.formData during flight, then server value
  const optimistic =
    fetcher.formData?.get('correctedComplexity')?.toString() ??
    correctedComplexity
  const validCorrected =
    optimistic != null &&
    (PR_SIZE_LABELS as readonly string[]).includes(optimistic)
      ? (optimistic as PRSizeLabel)
      : null

  const originalLabel = getPRComplexity({ complexity })
  const displayLabel = validCorrected ?? originalLabel
  const hasFeedback = validCorrected != null && validCorrected !== originalLabel

  if (originalLabel === 'Unclassified' && !hasFeedback) return null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="cursor-pointer">
          <Badge
            variant="default"
            className={cn('text-xs', PR_SIZE_STYLE[displayLabel])}
          >
            {displayLabel}
            {hasFeedback && <PencilIcon className="ml-0.5 inline size-3" />}
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="start">
        {originalLabel !== 'Unclassified' && (
          <div className="mb-2 max-w-64 space-y-1 text-xs">
            <div className="flex items-center gap-1.5">
              <Badge
                variant="default"
                className={cn('text-[10px]', PR_SIZE_STYLE[originalLabel])}
              >
                {originalLabel}
              </Badge>
              <span className="text-muted-foreground text-[10px]">by AI</span>
            </div>
            {complexityReason && (
              <p className="text-muted-foreground leading-snug">
                {complexityReason}
              </p>
            )}
            {riskAreas && (
              <div className="flex flex-wrap gap-1">
                {[...new Set(parseRiskAreas(riskAreas))].map((area) => (
                  <Badge
                    key={area}
                    variant="outline"
                    className="text-[10px] font-normal"
                  >
                    {area}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="flex gap-1">
          {PR_SIZE_LABELS.map((size) => (
            <button
              key={size}
              type="button"
              disabled={fetcher.state !== 'idle'}
              className={cn(
                'relative rounded px-2 py-1 text-xs font-medium transition-opacity',
                PR_SIZE_STYLE[size],
                'cursor-pointer hover:opacity-80',
                'disabled:cursor-not-allowed disabled:opacity-50',
              )}
              onClick={() => {
                const formData = new FormData()
                formData.set('pullRequestNumber', String(number))
                formData.set('repositoryId', repositoryId)
                formData.set('correctedComplexity', size)
                fetcher.submit(formData, {
                  method: 'post',
                  action: `/${orgSlug}/pr-size-feedback`,
                })
                setOpen(false)
              }}
            >
              {size}
              {displayLabel === size && (
                <CheckIcon className="ml-0.5 inline size-3" />
              )}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
