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
    bg: 'bg-blue-500',
    ring: 'ring-blue-500',
    bgFaint: 'bg-blue-500/20',
    label: '< 1d',
  },
  {
    maxDays: 3,
    bg: 'bg-emerald-500',
    ring: 'ring-emerald-500',
    bgFaint: 'bg-emerald-500/20',
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
    maxDays: 14,
    bg: 'bg-red-500',
    ring: 'ring-red-500',
    bgFaint: 'bg-red-500/20',
    label: '7-14d',
  },
  {
    maxDays: 30,
    bg: 'bg-purple-500',
    ring: 'ring-purple-500',
    bgFaint: 'bg-purple-500/20',
    label: '14-30d',
  },
  {
    maxDays: Infinity,
    bg: 'bg-neutral-800',
    ring: 'ring-neutral-800',
    bgFaint: 'bg-neutral-800/20',
    label: '31d+',
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

export type PRReviewStatus =
  | 'in-review'
  | 'unassigned'
  | 'approved-awaiting-merge'
  | 'changes-pending'

export type PRReviewerState =
  | 'APPROVED'
  | 'CHANGES_REQUESTED'
  | 'COMMENTED'
  | 'REQUESTED'

export interface PRReviewerStateEntry {
  login: string
  displayName: string
  state: PRReviewerState
  submittedAt?: string
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
  reviewStatus?: PRReviewStatus
  reviewerStates?: PRReviewerStateEntry[]
}

interface ReviewStatusShape {
  label: string
  text: string
  /** Tailwind classes controlling shape (border-radius, rotation, etc.) */
  shape: string
  /** Legend swatch classes — shape + neutral fill for the legend row */
  legendSwatch: string
}

export const REVIEW_STATUS_SHAPE: Record<PRReviewStatus, ReviewStatusShape> = {
  'in-review': {
    label: 'レビュー中',
    text: 'text-muted-foreground',
    shape: 'rounded-full',
    legendSwatch: 'size-3 rounded-full bg-current',
  },
  unassigned: {
    label: 'Unassigned',
    text: 'text-amber-600 dark:text-amber-400',
    shape: 'rounded-full',
    legendSwatch:
      'size-3 rounded-full ring-[1.5px] ring-inset ring-current bg-current/20',
  },
  'approved-awaiting-merge': {
    label: 'Approved',
    text: 'text-emerald-600 dark:text-emerald-400',
    shape: 'rounded-sm',
    legendSwatch:
      'size-3 rounded-sm ring-[1.5px] ring-inset ring-current bg-current/20',
  },
  'changes-pending': {
    label: 'Changes',
    text: 'text-amber-600 dark:text-amber-400',
    shape: 'rotate-45 rounded-sm',
    legendSwatch:
      'size-3 rotate-45 rounded-sm ring-[1.5px] ring-inset ring-current bg-current/20',
  },
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
  REQUESTED: {
    icon: '⏳',
    text: 'Requested',
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
  const statusShape = pr.reviewStatus
    ? REVIEW_STATUS_SHAPE[pr.reviewStatus]
    : undefined
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
        {statusShape && (
          <span className={statusShape.text}>{statusShape.label}</span>
        )}
      </div>
      {pr.reviewerStates && pr.reviewerStates.length > 0 && (
        <div className="mt-1.5 space-y-0.5 border-t pt-1.5">
          {pr.reviewerStates.map((r) => {
            const style = REVIEW_STATE_STYLE[r.state]
            const when = r.submittedAt
              ? dayjs.utc(r.submittedAt).format('YYYY/MM/DD HH:mm')
              : undefined
            return (
              <div key={r.login} className="flex items-center gap-2 text-xs">
                <span
                  className={`w-20 shrink-0 whitespace-nowrap ${style.className}`}
                >
                  {style.icon} {style.text}
                </span>
                <span className="truncate">{r.displayName}</span>
                {when && (
                  <span className="text-muted-foreground ml-auto shrink-0">
                    {when}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function PRBlock({
  pr,
  colorMode = 'size',
  showAuthor,
  onMouseEnter,
  onMouseLeave,
  onClick,
  dataPrKey,
}: {
  pr: PRBlockData
  colorMode?: PRBlockColorMode
  showAuthor?: boolean
  onMouseEnter?: (e: React.MouseEvent<HTMLButtonElement>) => void
  onMouseLeave?: () => void
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
  dataPrKey?: string
}) {
  const { bg, ring, bgFaint } = getBlockColor(pr, colorMode)
  const statusShape = pr.reviewStatus
    ? REVIEW_STATUS_SHAPE[pr.reviewStatus]
    : undefined
  const shape = statusShape?.shape ?? 'rounded-full'
  const ariaLabel = statusShape
    ? `${pr.repo}#${pr.number} (${statusShape.label})`
    : `${pr.repo}#${pr.number}`
  const isHollow =
    pr.reviewStatus === 'unassigned' ||
    pr.reviewStatus === 'approved-awaiting-merge' ||
    pr.reviewStatus === 'changes-pending'
  const fillClass = isHollow ? `ring-[2px] ring-inset ${ring} ${bgFaint}` : bg

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-pr-key={dataPrKey}
          className={`size-4 shrink-0 transition-all hover:scale-150 ${shape} ${fillClass}`}
          aria-label={ariaLabel}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          onClick={onClick}
        />
      </PopoverTrigger>
      <PopoverContent side="top" className="w-72 p-3">
        <PRPopoverContent pr={pr} showAuthor={showAuthor} />
      </PopoverContent>
    </Popover>
  )
}
