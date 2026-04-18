import { type ColumnDef, createColumnHelper } from '@tanstack/react-table'
import { ArrowDownIcon, ArrowUpIcon, MinusIcon } from 'lucide-react'
import { Badge } from '~/app/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '~/app/components/ui/tooltip'
import dayjs from '~/app/libs/dayjs'
import {
  PR_SIZE_RANK,
  PR_SIZE_STYLE,
  type PRSizeLabel,
} from '~/app/libs/pr-classify'
import { cn } from '~/app/libs/utils'
import { hidePrActionsColumn } from '~/app/routes/$orgSlug/+components/hide-prs-by-title-menu'
import type { FeedbackRow } from '../+functions/queries.server'

function SizeBadgeInline({ size }: { size: string | null }) {
  if (!size) return <span className="text-muted-foreground">—</span>
  const label = size as PRSizeLabel
  const style = PR_SIZE_STYLE[label]
  if (!style) return <span className="text-muted-foreground">{size}</span>
  return <Badge className={cn('text-xs', style)}>{label}</Badge>
}

function DirectionIcon({
  original,
  corrected,
}: {
  original: string | null
  corrected: string
}) {
  const origRank = PR_SIZE_RANK[original ?? ''] ?? -1
  const corrRank = PR_SIZE_RANK[corrected] ?? -1

  if (origRank < 0 || corrRank < 0)
    return <MinusIcon className="text-muted-foreground h-4 w-4" />
  if (corrRank > origRank)
    return <ArrowUpIcon className="h-4 w-4 text-amber-600" />
  if (corrRank < origRank)
    return <ArrowDownIcon className="h-4 w-4 text-emerald-600" />
  return <MinusIcon className="text-muted-foreground h-4 w-4" />
}

const columnHelper = createColumnHelper<FeedbackRow>()

export function createFeedbackColumns(
  isAdmin: boolean,
): ColumnDef<FeedbackRow, unknown>[] {
  return [
    columnHelper.accessor('repoName', {
      header: 'Repository',
      cell: (info) => (
        <span className="text-sm text-nowrap">
          {info.row.original.repoOwner}/{info.getValue()}
        </span>
      ),
      enableSorting: true,
      id: 'repository',
    }),
    columnHelper.accessor('prTitle', {
      header: 'PR',
      cell: (info) => (
        <a
          href={info.row.original.prUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline"
        >
          <span className="text-muted-foreground mr-1">
            #{info.row.original.pullRequestNumber}
          </span>
          <span className="line-clamp-1">{info.getValue()}</span>
        </a>
      ),
      enableSorting: false,
    }),
    columnHelper.accessor('originalComplexity', {
      header: 'Original',
      cell: (info) => <SizeBadgeInline size={info.getValue()} />,
      enableSorting: false,
    }),
    columnHelper.display({
      id: 'direction',
      header: '',
      cell: (info) => (
        <DirectionIcon
          original={info.row.original.originalComplexity}
          corrected={info.row.original.correctedComplexity}
        />
      ),
    }),
    columnHelper.accessor('correctedComplexity', {
      header: 'Corrected',
      cell: (info) => <SizeBadgeInline size={info.getValue()} />,
      enableSorting: false,
    }),
    columnHelper.accessor('reason', {
      header: 'Reason',
      cell: (info) => {
        const value = info.getValue()
        if (!value) return <span className="text-muted-foreground">—</span>
        if (value.length <= 60) return <span className="text-sm">{value}</span>
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help text-sm">{value.slice(0, 60)}…</span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">{value}</TooltipContent>
          </Tooltip>
        )
      },
      enableSorting: false,
    }),
    columnHelper.accessor('feedbackByLogin', {
      header: 'By',
      cell: (info) => {
        const login = info.getValue()
        if (!login) return <span className="text-muted-foreground">—</span>
        const displayName = info.row.original.feedbackByDisplayName ?? login
        return (
          <div className="flex items-center gap-1.5">
            <img
              src={`https://github.com/${login}.png?size=32`}
              alt={login}
              className="h-5 w-5 rounded-full"
            />
            <span className="text-sm text-nowrap">{displayName}</span>
          </div>
        )
      },
      enableSorting: false,
    }),
    columnHelper.accessor('updatedAt', {
      header: 'Updated',
      cell: (info) => (
        <span className="text-muted-foreground text-sm text-nowrap">
          {dayjs.utc(info.getValue()).fromNow()}
        </span>
      ),
      enableSorting: true,
    }),
    ...hidePrActionsColumn<FeedbackRow>(isAdmin, (r) => r.prTitle),
  ]
}
