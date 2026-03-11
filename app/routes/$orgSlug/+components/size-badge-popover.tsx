import {
  CheckIcon,
  LoaderCircleIcon,
  PencilIcon,
  SparklesIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useFetcher, useParams } from 'react-router'
import { Badge, Button } from '~/app/components/ui'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/app/components/ui/popover'
import { Textarea } from '~/app/components/ui/textarea'
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
  reason: string | null
  repositoryId: string
  number: number
}

export function SizeBadgePopover({
  complexity,
  complexityReason,
  riskAreas,
  correctedComplexity,
  reason,
  repositoryId,
  number,
}: SizeBadgePopoverProps) {
  const { orgSlug } = useParams()
  const fetcher = useFetcher()
  const draftFetcher = useFetcher<{ reason?: string; error?: string }>()
  const [open, setOpen] = useState(false)
  const [selectedSize, setSelectedSize] = useState<PRSizeLabel | null>(null)
  const [reasonText, setReasonText] = useState(reason ?? '')

  // When AI draft returns, update reason text
  useEffect(() => {
    if (draftFetcher.data?.reason) {
      setReasonText(draftFetcher.data.reason)
    }
  }, [draftFetcher.data])

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

  const isSaving = fetcher.state !== 'idle'
  const isDrafting = draftFetcher.state !== 'idle'
  const isBusy = isSaving || isDrafting

  // Close popover after save completes successfully
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data) {
      setOpen(false)
      setSelectedSize(null)
    }
  }, [fetcher.state, fetcher.data])

  if (originalLabel === 'Unclassified' && !hasFeedback) return null

  const buildFormData = (size: PRSizeLabel) => {
    const fd = new FormData()
    fd.set('pullRequestNumber', String(number))
    fd.set('repositoryId', repositoryId)
    fd.set('correctedComplexity', size)
    return fd
  }

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (nextOpen) {
          setReasonText(reason ?? '')
          setSelectedSize(null)
        } else {
          setSelectedSize(null)
        }
      }}
    >
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
      <PopoverContent className="w-80 max-w-sm p-2" align="start">
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
              disabled={isBusy}
              className={cn(
                'relative rounded px-2 py-1 text-xs font-medium transition-opacity',
                PR_SIZE_STYLE[size],
                'cursor-pointer hover:opacity-80',
                'disabled:cursor-not-allowed disabled:opacity-50',
                selectedSize === size && 'ring-2 ring-offset-1',
              )}
              onClick={() =>
                setSelectedSize(selectedSize === size ? null : size)
              }
            >
              {size}
              {(selectedSize == null
                ? displayLabel === size
                : selectedSize === size) && (
                <CheckIcon className="ml-0.5 inline size-3" />
              )}
            </button>
          ))}
        </div>
        <div className="mt-2 space-y-2">
          <Textarea
            placeholder={`Why ${selectedSize ?? displayLabel}? (optional)`}
            value={reasonText}
            onChange={(e) => setReasonText(e.target.value)}
            rows={2}
            className="max-h-20 text-xs"
          />
          {draftFetcher.data?.error && (
            <p className="text-destructive text-[10px]">
              {draftFetcher.data.error}
            </p>
          )}
          <div className="flex justify-end gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 text-xs"
              disabled={isDrafting || selectedSize == null}
              onClick={() => {
                if (selectedSize == null) return
                const fd = buildFormData(selectedSize)
                draftFetcher.submit(fd, {
                  method: 'post',
                  action: `/${orgSlug}/draft-feedback-reason`,
                })
              }}
            >
              {isDrafting ? (
                <LoaderCircleIcon className="size-3 animate-spin" />
              ) : (
                <SparklesIcon className="size-3" />
              )}
              AI Draft
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-6 text-xs"
              disabled={isBusy || selectedSize == null}
              onClick={() => {
                if (selectedSize == null) return
                const fd = buildFormData(selectedSize)
                fd.set('reason', reasonText)
                fetcher.submit(fd, {
                  method: 'post',
                  action: `/${orgSlug}/pr-size-feedback`,
                })
              }}
            >
              Save
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
