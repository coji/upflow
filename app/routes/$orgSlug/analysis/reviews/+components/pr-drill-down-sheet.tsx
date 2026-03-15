import { ExternalLinkIcon } from 'lucide-react'
import { Badge } from '~/app/components/ui'
import { Avatar, AvatarFallback, AvatarImage } from '~/app/components/ui/avatar'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '~/app/components/ui/sheet'
import { SizeBadge } from '~/app/routes/$orgSlug/+components/size-badge'
import { parseRiskAreas } from '../+functions/classify'

export interface DrillDownPR {
  number: number
  title: string
  url: string
  repo: string
  author: string
  authorDisplayName?: string | null
  reviewTime?: number | null
  size?: string | null
  complexityReason?: string | null
  riskAreas?: string | null
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
  description?: React.ReactNode
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
        <div className="flex-1 overflow-y-auto px-6">
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
                  <SizeBadge complexity={pr.size ?? null} />
                  <span className="text-muted-foreground flex items-center gap-1 text-xs">
                    <Avatar className="size-4">
                      <AvatarImage
                        src={`https://github.com/${pr.author}.png`}
                        alt={pr.author}
                      />
                      <AvatarFallback className="text-[8px]">
                        {pr.author.slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    {pr.authorDisplayName ?? pr.author}
                  </span>
                  {pr.reviewTime != null && pr.reviewTime > 0 && (
                    <span className="text-muted-foreground ml-auto text-xs">
                      {formatHours(pr.reviewTime * 24)}
                    </span>
                  )}
                </div>
                <a
                  href={pr.url}
                  className="truncate text-sm hover:underline"
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  {pr.title}
                </a>
                {(pr.complexityReason || pr.riskAreas) && (
                  <div className="space-y-0.5 text-xs">
                    {pr.complexityReason && (
                      <p className="text-muted-foreground">
                        {pr.complexityReason}
                      </p>
                    )}
                    {pr.riskAreas && (
                      <div className="flex flex-wrap gap-1">
                        {parseRiskAreas(pr.riskAreas).map((area) => (
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
              </div>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
