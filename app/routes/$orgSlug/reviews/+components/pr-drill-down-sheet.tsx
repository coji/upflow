import { ExternalLinkIcon } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '~/app/components/ui/sheet'

export interface DrillDownPR {
  number: number
  title: string
  url: string
  repo: string
  author: string
  reviewTime?: number | null
}

function formatHours(h: number): string {
  if (h < 1) return `${(h * 60).toFixed(0)}m`
  if (h < 24) return `${h.toFixed(1)}h`
  return `${(h / 24).toFixed(1)}d`
}

interface PRDrillDownSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  prs: DrillDownPR[]
}

export function PRDrillDownSheet({
  open,
  onOpenChange,
  title,
  description,
  prs,
}: PRDrillDownSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            {description ?? `${prs.length} pull requests`}
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto">
          <div className="divide-y">
            {prs.map((pr) => (
              <div
                key={`${pr.repo}#${pr.number}`}
                className="flex flex-col gap-1 py-3"
              >
                <div className="flex items-center gap-2">
                  <a
                    href={pr.url}
                    className="text-muted-foreground shrink-0 text-xs hover:underline"
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    {pr.repo}#{pr.number}
                    <ExternalLinkIcon className="ml-0.5 inline-block h-3 w-3" />
                  </a>
                  <span className="text-muted-foreground text-xs">
                    by {pr.author}
                  </span>
                  {pr.reviewTime != null && pr.reviewTime > 0 && (
                    <span className="text-muted-foreground ml-auto text-xs">
                      {formatHours(pr.reviewTime * 24)}
                    </span>
                  )}
                </div>
                <a
                  href={pr.url}
                  className="truncate text-sm text-blue-500 hover:underline"
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  {pr.title}
                </a>
              </div>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
