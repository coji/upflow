import { SizeBadge } from '~/app/components/size-badge'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/app/components/ui/popover'
import dayjs from '~/app/libs/dayjs'

export type PRBlockColorMode = 'size' | 'age'

export interface BlockColor {
  bg: string
  ring: string
  bgFaint: string
}

export const SIZE_BLOCK_COLORS: Record<string, BlockColor> = {
  XS: {
    bg: 'bg-slate-400',
    ring: 'ring-slate-400',
    bgFaint: 'bg-slate-400/20',
  },
  S: {
    bg: 'bg-emerald-500',
    ring: 'ring-emerald-500',
    bgFaint: 'bg-emerald-500/20',
  },
  M: { bg: 'bg-blue-500', ring: 'ring-blue-500', bgFaint: 'bg-blue-500/20' },
  L: {
    bg: 'bg-amber-500',
    ring: 'ring-amber-500',
    bgFaint: 'bg-amber-500/20',
  },
  XL: { bg: 'bg-red-500', ring: 'ring-red-500', bgFaint: 'bg-red-500/20' },
}

export const UNKNOWN_COLOR: BlockColor = {
  bg: 'bg-gray-300 dark:bg-gray-600',
  ring: 'ring-gray-400',
  bgFaint: 'bg-gray-400/20',
}

export const AGE_THRESHOLDS = [
  {
    maxDays: 1,
    bg: 'bg-emerald-500',
    ring: 'ring-emerald-500',
    bgFaint: 'bg-emerald-500/20',
    label: '< 1d',
  },
  {
    maxDays: 3,
    bg: 'bg-blue-500',
    ring: 'ring-blue-500',
    bgFaint: 'bg-blue-500/20',
    label: '1-3d',
  },
  {
    maxDays: 7,
    bg: 'bg-amber-500',
    ring: 'ring-amber-500',
    bgFaint: 'bg-amber-500/20',
    label: '3-7d',
  },
  {
    maxDays: Infinity,
    bg: 'bg-red-500',
    ring: 'ring-red-500',
    bgFaint: 'bg-red-500/20',
    label: '7d+',
  },
] as const

function getSizeColor(complexity: string | null): BlockColor {
  if (!complexity) return UNKNOWN_COLOR
  return SIZE_BLOCK_COLORS[complexity] ?? UNKNOWN_COLOR
}

function getAgeColor(createdAt: string): BlockColor {
  const days = dayjs().diff(dayjs.utc(createdAt), 'day', true)
  for (const t of AGE_THRESHOLDS) {
    if (days < t.maxDays) return { bg: t.bg, ring: t.ring, bgFaint: t.bgFaint }
  }
  const last = AGE_THRESHOLDS[AGE_THRESHOLDS.length - 1]
  return { bg: last.bg, ring: last.ring, bgFaint: last.bgFaint }
}

function getBlockColor(pr: PRBlockData, mode: PRBlockColorMode): BlockColor {
  return mode === 'size'
    ? getSizeColor(pr.complexity)
    : getAgeColor(pr.createdAt)
}

export interface PRBlockData {
  number: number
  repo: string
  title: string
  url: string
  author?: string
  createdAt: string
  complexity: string | null
  /** true = has reviewer, false = no reviewer (ring style), undefined = unknown (solid) */
  hasReviewer?: boolean
  reviewers?: string[]
}

export const REVIEW_STATE_STYLE: Record<
  string,
  { icon: string; text: string; className: string }
> = {
  APPROVED: { icon: '✓', text: 'Approved', className: 'text-emerald-600' },
  CHANGES_REQUESTED: { icon: '✗', text: 'Changes', className: 'text-red-500' },
  COMMENTED: {
    icon: '💬',
    text: 'Comment',
    className: 'text-muted-foreground',
  },
}

export function PRPopoverContent({
  pr,
  showAuthor,
  reviewState,
}: {
  pr: PRBlockData
  showAuthor?: boolean
  reviewState?: string
}) {
  const ageDays = Math.floor(dayjs().diff(dayjs.utc(pr.createdAt), 'day', true))
  const stateInfo = reviewState ? REVIEW_STATE_STYLE[reviewState] : null
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <a
          href={pr.url}
          className="text-xs font-medium hover:underline"
          target="_blank"
          rel="noreferrer noopener"
        >
          {pr.repo}#{pr.number}
        </a>
        <SizeBadge complexity={pr.complexity} />
        {stateInfo && (
          <span className={`text-xs font-medium ${stateInfo.className}`}>
            {stateInfo.icon} {stateInfo.text}
          </span>
        )}
      </div>
      <p className="text-muted-foreground truncate text-xs">{pr.title}</p>
      <div className="text-muted-foreground flex flex-wrap gap-x-2 text-xs">
        {showAuthor && pr.author && <span>by {pr.author}</span>}
        <span>{ageDays}d ago</span>
        {pr.reviewers && pr.reviewers.length > 0 && (
          <span>→ {pr.reviewers.join(', ')}</span>
        )}
        {pr.hasReviewer === false && (
          <span className="text-amber-600 dark:text-amber-400">
            no reviewer
          </span>
        )}
      </div>
    </div>
  )
}

export function PRBlock({
  pr,
  colorMode = 'size',
  showAuthor,
  onMouseEnter,
  onMouseLeave,
  dataPrKey,
}: {
  pr: PRBlockData
  colorMode?: PRBlockColorMode
  showAuthor?: boolean
  onMouseEnter?: (e: React.MouseEvent<HTMLButtonElement>) => void
  onMouseLeave?: () => void
  dataPrKey?: string
}) {
  const { bg, ring, bgFaint } = getBlockColor(pr, colorMode)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-pr-key={dataPrKey}
          className={`size-4 shrink-0 rounded-full transition-all hover:scale-150 ${pr.hasReviewer === false ? `ring-[2px] ring-inset ${ring} ${bgFaint}` : bg}`}
          aria-label={`${pr.repo}#${pr.number}`}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
        />
      </PopoverTrigger>
      <PopoverContent side="top" className="w-72 p-3">
        <PRPopoverContent pr={pr} showAuthor={showAuthor} />
      </PopoverContent>
    </Popover>
  )
}
