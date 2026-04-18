import { MoreHorizontalIcon } from 'lucide-react'
import { Popover as PopoverPrimitive } from 'radix-ui'
import { createContext, useContext, useRef, useState } from 'react'
import { href, useFetcher, useParams } from 'react-router'
import { SizeBadge } from '~/app/components/size-badge'
import { Avatar, AvatarFallback, AvatarImage } from '~/app/components/ui/avatar'
import { Badge } from '~/app/components/ui/badge'
import { Button } from '~/app/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/app/components/ui/dropdown-menu'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/app/components/ui/popover'
import { Skeleton } from '~/app/components/ui/skeleton'
import dayjs from '~/app/libs/dayjs'
import { cn } from '~/app/libs/utils'

/**
 * PRPopoverContent 内で「タイトルパターンで除外」ボタンを出すための context。
 * null (provide されない) / null 値の場合はボタン非表示。admin のみ表示する親ページが value を設定する。
 */
export const PRHideByTitleFilterContext = createContext<
  ((title: string) => void) | null
>(null)

export type PRBlockColorMode = 'size' | 'age'

export interface BlockColor {
  bg: string
  ring: string
  bgFaint: string
  text: string
}

export const SIZE_BLOCK_COLORS: Record<string, BlockColor> = {
  XS: {
    bg: 'bg-slate-400',
    ring: 'ring-slate-400',
    bgFaint: 'bg-slate-400/20',
    text: 'text-slate-400',
  },
  S: {
    bg: 'bg-emerald-500',
    ring: 'ring-emerald-500',
    bgFaint: 'bg-emerald-500/20',
    text: 'text-emerald-500',
  },
  M: {
    bg: 'bg-blue-500',
    ring: 'ring-blue-500',
    bgFaint: 'bg-blue-500/20',
    text: 'text-blue-500',
  },
  L: {
    bg: 'bg-amber-500',
    ring: 'ring-amber-500',
    bgFaint: 'bg-amber-500/20',
    text: 'text-amber-500',
  },
  XL: {
    bg: 'bg-red-500',
    ring: 'ring-red-500',
    bgFaint: 'bg-red-500/20',
    text: 'text-red-500',
  },
}

export const UNKNOWN_COLOR: BlockColor = {
  bg: 'bg-gray-300 dark:bg-gray-600',
  ring: 'ring-gray-400',
  bgFaint: 'bg-gray-400/20',
  text: 'text-gray-400',
}

export const AGE_THRESHOLDS = [
  {
    maxDays: 1,
    bg: 'bg-blue-500',
    ring: 'ring-blue-500',
    bgFaint: 'bg-blue-500/20',
    text: 'text-blue-500',
    label: '< 1d',
  },
  {
    maxDays: 3,
    bg: 'bg-emerald-500',
    ring: 'ring-emerald-500',
    bgFaint: 'bg-emerald-500/20',
    text: 'text-emerald-500',
    label: '1-3d',
  },
  {
    maxDays: 7,
    bg: 'bg-amber-500',
    ring: 'ring-amber-500',
    bgFaint: 'bg-amber-500/20',
    text: 'text-amber-500',
    label: '3-7d',
  },
  {
    maxDays: 14,
    bg: 'bg-red-500',
    ring: 'ring-red-500',
    bgFaint: 'bg-red-500/20',
    text: 'text-red-500',
    label: '7-14d',
  },
  {
    maxDays: 30,
    bg: 'bg-purple-500',
    ring: 'ring-purple-500',
    bgFaint: 'bg-purple-500/20',
    text: 'text-purple-500',
    label: '14-30d',
  },
  {
    maxDays: Infinity,
    bg: 'bg-neutral-800',
    ring: 'ring-neutral-800',
    bgFaint: 'bg-neutral-800/20',
    text: 'text-neutral-800',
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
    if (days < t.maxDays)
      return { bg: t.bg, ring: t.ring, bgFaint: t.bgFaint, text: t.text }
  }
  const last = AGE_THRESHOLDS[AGE_THRESHOLDS.length - 1]
  return {
    bg: last.bg,
    ring: last.ring,
    bgFaint: last.bgFaint,
    text: last.text,
  }
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

/** Popover enrichment from `resources/pr-popover` (and `getPullRequestForPopover`). */
export interface PRPopoverData {
  number: number
  repo: string
  title: string
  url: string
  createdAt: string
  complexity: string | null
  author: string
  authorDisplayName: string | null
  reviewStatus: PRReviewStatus
  reviewerStates: PRReviewerStateEntry[]
}

export type PRPopoverLoaderData = {
  pr: PRPopoverData | null
  error?: 'not_found' | 'fetch_failed'
}

export interface PRBlockData {
  number: number
  repo: string
  repositoryId: string
  title?: string
  url?: string
  createdAt: string
  complexity: string | null
  reviewStatus?: PRReviewStatus
}

interface ReviewStatusShape {
  label: string
  text: string
  shape: string
  legendSwatch: string
  /** Small icon rendered inside the block (e.g. ✓ for approved) */
  icon?: string
}

export const REVIEW_STATUS_SHAPE: Record<PRReviewStatus, ReviewStatusShape> = {
  'in-review': {
    label: 'In review',
    text: 'text-muted-foreground',
    shape: 'rounded-full',
    legendSwatch: 'size-3.5 rounded-full bg-gray-400 dark:bg-gray-500',
    icon: undefined,
  },
  unassigned: {
    label: 'Unassigned',
    text: 'text-amber-600 dark:text-amber-400',
    shape: 'rounded-full',
    legendSwatch:
      'size-3.5 rounded-full ring-[1.5px] ring-inset ring-gray-400 bg-gray-400/20 dark:ring-gray-500 dark:bg-gray-500/20',
    icon: undefined,
  },
  'approved-awaiting-merge': {
    label: 'Approved',
    text: 'text-emerald-600 dark:text-emerald-400',
    shape: 'rounded-full',
    legendSwatch:
      'size-3.5 rounded-full ring-[1.5px] ring-inset ring-gray-400 bg-gray-400/20 dark:ring-gray-500 dark:bg-gray-500/20',
    icon: '✓',
  },
  'changes-pending': {
    label: 'Changes',
    text: 'text-amber-600 dark:text-amber-400',
    shape: 'rounded-full',
    legendSwatch:
      'size-3.5 rounded-full ring-[1.5px] ring-inset ring-gray-400 bg-gray-400/20 dark:ring-gray-500 dark:bg-gray-500/20',
    icon: '✗',
  },
}

export const REVIEW_STATUS_PRIORITY: Record<PRReviewStatus, number> = {
  'approved-awaiting-merge': 0,
  'changes-pending': 1,
  unassigned: 2,
  'in-review': 3,
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

function GitHubAvatar({ login, size }: { login: string; size: number }) {
  return (
    <Avatar style={{ width: size, height: size }} className="shrink-0">
      <AvatarImage src={`https://github.com/${login}.png`} alt={login} />
      <AvatarFallback
        className="text-[6px]"
        style={{ width: size, height: size }}
      >
        {login.slice(0, 2)}
      </AvatarFallback>
    </Avatar>
  )
}

function PRPopoverSkeleton() {
  return (
    <div className="flex h-[120px] flex-col justify-center gap-2">
      <Skeleton className="h-3 w-3/4" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-5/6" />
    </div>
  )
}

function HidePRsByTitleMenu({
  title,
  className,
}: {
  title: string
  className?: string
}) {
  const onHideByTitle = useContext(PRHideByTitleFilterContext)
  if (!onHideByTitle) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className={cn('size-5', className)}
          aria-label="More actions"
        >
          <MoreHorizontalIcon size={14} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => onHideByTitle(title)}>
          Hide PRs by title…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function PRPopoverDegraded({
  prKey,
  fallback,
}: {
  prKey: { repositoryId: string; number: number }
  fallback?: { title?: string; url?: string; repo?: string }
}) {
  const linkLabel = fallback?.repo
    ? `${fallback.repo}#${prKey.number}`
    : `${prKey.repositoryId}#${prKey.number}`
  const linkHref = fallback?.url

  return (
    <div className="space-y-1 text-xs">
      <div className="flex items-center gap-2">
        {linkHref ? (
          <a
            href={linkHref}
            className="font-medium hover:underline"
            target="_blank"
            rel="noreferrer noopener"
          >
            {linkLabel}
          </a>
        ) : (
          <span className="font-medium">{linkLabel}</span>
        )}
        {fallback?.title && (
          <HidePRsByTitleMenu title={fallback.title} className="ml-auto" />
        )}
      </div>
      {fallback?.title && (
        <p className="text-muted-foreground line-clamp-3">{fallback.title}</p>
      )}
    </div>
  )
}

export function PRPopoverContent({
  pr,
  reviewState,
}: {
  pr: PRPopoverData
  reviewState?: string
}) {
  const createdAgo = dayjs.utc(pr.createdAt).fromNow()
  const stateInfo = reviewState ? REVIEW_STATE_STYLE[reviewState] : null
  const statusShape = REVIEW_STATUS_SHAPE[pr.reviewStatus]

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <a
          href={pr.url}
          className="text-xs font-medium hover:underline"
          target="_blank"
          rel="noreferrer noopener"
        >
          {pr.repo}#{pr.number}
        </a>
        <SizeBadge
          complexity={pr.complexity}
          className="ml-auto px-1.5 py-0 text-[10px]"
        />
        <HidePRsByTitleMenu title={pr.title} />
      </div>
      <a
        href={pr.url}
        target="_blank"
        rel="noreferrer noopener"
        className="line-clamp-3 text-xs hover:underline"
      >
        {pr.title}
      </a>
      <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-xs">
        <span className="inline-flex items-center gap-1">
          <GitHubAvatar login={pr.author} size={14} />
          {pr.authorDisplayName ?? pr.author}
        </span>
        <span>{createdAgo}</span>
        <Badge
          variant="outline"
          className={`ml-auto border-current px-1.5 py-0 text-[10px] font-normal ${statusShape.text}`}
        >
          {statusShape.label}
        </Badge>
      </div>
      {stateInfo && (
        <div className="space-y-0.5">
          <div className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
            この日の review
          </div>
          <div className={`text-xs font-medium ${stateInfo.className}`}>
            {stateInfo.icon} {stateInfo.text}
          </div>
        </div>
      )}
      {pr.reviewerStates.length > 0 && (
        <div className="space-y-1 border-t pt-2">
          <div className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
            Reviewers
          </div>
          <div className="space-y-0.5">
            {pr.reviewerStates.map((r) => {
              const style = REVIEW_STATE_STYLE[r.state]
              const when = r.submittedAt
                ? dayjs.utc(r.submittedAt).fromNow()
                : undefined
              return (
                <div key={r.login} className="flex items-center gap-2 text-xs">
                  <span
                    className={`w-20 shrink-0 whitespace-nowrap ${style.className}`}
                  >
                    {style.icon} {style.text}
                  </span>
                  <GitHubAvatar login={r.login} size={14} />
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
        </div>
      )}
    </div>
  )
}

const ERROR_MESSAGES = {
  not_found: 'PR が見つかりませんでした',
  fetch_failed: 'PR の情報を取得できませんでした',
} as const

export function PRPopover({
  prKey,
  reviewState,
  fallback,
  children,
}: {
  prKey: { repositoryId: string; number: number }
  reviewState?: string
  fallback?: { title?: string; url?: string; repo?: string }
  children: React.ReactNode
}) {
  const { orgSlug } = useParams<{ orgSlug: string }>()
  const fetcher = useFetcher<PRPopoverLoaderData>({
    key: `pr-popover:${orgSlug}:${prKey.repositoryId}:${prKey.number}`,
  })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [side, setSide] = useState<'top' | 'bottom'>('top')

  const resourceHref = orgSlug
    ? href('/:orgSlug/resources/pr-popover/:repositoryId/:number', {
        orgSlug,
        repositoryId: prKey.repositoryId,
        number: String(prKey.number),
      })
    : null

  const renderBody = () => {
    const d = fetcher.data

    if (d?.pr) {
      return <PRPopoverContent pr={d.pr} reviewState={reviewState} />
    }
    if (d?.error) {
      return (
        <div className="space-y-2">
          <p className="text-muted-foreground text-xs">
            {ERROR_MESSAGES[d.error]}
          </p>
          <PRPopoverDegraded prKey={prKey} fallback={fallback} />
        </div>
      )
    }
    // Default to skeleton on first paint to keep popover height stable
    // before fetcher.state flips to 'loading' on the next tick.
    return <PRPopoverSkeleton />
  }

  return (
    <Popover
      onOpenChange={(open) => {
        if (!open) return
        const rect = triggerRef.current?.getBoundingClientRect()
        if (rect) {
          setSide(rect.top > window.innerHeight / 2 ? 'top' : 'bottom')
        }
        if (resourceHref && fetcher.state === 'idle') {
          void fetcher.load(resourceHref)
        }
      }}
    >
      <PopoverTrigger ref={triggerRef} asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent side={side} avoidCollisions={false} className="w-72 p-3">
        {renderBody()}
        <PopoverPrimitive.Arrow className="bg-popover fill-popover border-border size-2.5 -translate-y-1/2 rotate-45 border-r border-b" />
      </PopoverContent>
    </Popover>
  )
}

export function PRBlock({
  pr,
  colorMode = 'size',
  onMouseEnter,
  onMouseLeave,
  onClick,
  dataPrKey,
}: {
  pr: PRBlockData
  colorMode?: PRBlockColorMode
  onMouseEnter?: (e: React.MouseEvent<HTMLButtonElement>) => void
  onMouseLeave?: () => void
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
  dataPrKey?: string
}) {
  const {
    bg,
    ring,
    bgFaint,
    text: blockTextColor,
  } = getBlockColor(pr, colorMode)
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
    <PRPopover
      prKey={{ repositoryId: pr.repositoryId, number: pr.number }}
      fallback={{ title: pr.title, url: pr.url, repo: pr.repo }}
    >
      <button
        type="button"
        data-pr-key={dataPrKey}
        className={`flex size-4 shrink-0 items-center justify-center transition-all hover:scale-150 ${shape} ${fillClass}`}
        aria-label={ariaLabel}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onClick={onClick}
      >
        {statusShape?.icon && (
          <span
            className={`text-[8px] leading-none font-bold ${blockTextColor}`}
          >
            {statusShape.icon}
          </span>
        )}
      </button>
    </PRPopover>
  )
}
