import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useSearchParams } from 'react-router'
import { Avatar, AvatarFallback, AvatarImage } from '~/app/components/ui/avatar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/app/components/ui/popover'
import { ToggleGroup, ToggleGroupItem } from '~/app/components/ui/toggle-group'
import dayjs from '~/app/libs/dayjs'
import {
  PR_SIZE_LABELS,
  PR_SIZE_RANK,
} from '~/app/routes/$orgSlug/reviews/+functions/classify'
import type {
  PersonStack,
  StackPR,
  TeamStacksData,
} from '../+functions/aggregate-stacks'
import { SizeBadge } from '../../+components/size-badge'

type ColorMode = 'size' | 'age'

interface BlockColor {
  bg: string
  ring: string
  bgFaint: string
}

// --- Size mode ---

const SIZE_BLOCK_COLORS: Record<string, BlockColor> = {
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

const UNKNOWN_COLOR: BlockColor = {
  bg: 'bg-gray-300 dark:bg-gray-600',
  ring: 'ring-gray-400',
  bgFaint: 'bg-gray-400/20',
}

function getSizeColor(complexity: string | null): BlockColor {
  if (!complexity) return UNKNOWN_COLOR
  return SIZE_BLOCK_COLORS[complexity] ?? UNKNOWN_COLOR
}

function sortBySize(prs: StackPR[]): StackPR[] {
  return [...prs].sort((a, b) => {
    const ai = PR_SIZE_RANK[a.complexity ?? ''] ?? 99
    const bi = PR_SIZE_RANK[b.complexity ?? ''] ?? 99
    return bi - ai
  })
}

// --- Age mode ---

const AGE_THRESHOLDS = [
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

function getAgeDays(pr: StackPR): number {
  return dayjs().diff(dayjs(pr.createdAt), 'day', true)
}

function getAgeColor(pr: StackPR): BlockColor {
  const days = getAgeDays(pr)
  for (const t of AGE_THRESHOLDS) {
    if (days < t.maxDays) return { bg: t.bg, ring: t.ring, bgFaint: t.bgFaint }
  }
  const last = AGE_THRESHOLDS[AGE_THRESHOLDS.length - 1]
  return { bg: last.bg, ring: last.ring, bgFaint: last.bgFaint }
}

function sortByAge(prs: StackPR[]): StackPR[] {
  return [...prs].sort((a, b) => getAgeDays(b) - getAgeDays(a))
}

// --- Contexts ---
// - HoveredContext: changes on hover (StackRow reads for row highlighting)
// - SetHoveredContext: stable callback (PRBlock reads, never causes re-render)
// - ColorModeContext: changes on toggle only

interface HoveredInfo {
  prKey: string
  author: string
}

const HoveredContext = createContext<HoveredInfo | null>(null)
const SetHoveredContext = createContext<(info: HoveredInfo | null) => void>(
  () => {},
)
const ColorModeContext = createContext<ColorMode>('age')

function getBlockColor(pr: StackPR, mode: ColorMode): BlockColor {
  return mode === 'size' ? getSizeColor(pr.complexity) : getAgeColor(pr)
}

function sortPRs(prs: StackPR[], mode: ColorMode): StackPR[] {
  const baseSorted = mode === 'size' ? sortBySize(prs) : sortByAge(prs)
  const assigned: StackPR[] = []
  const unassigned: StackPR[] = []
  for (const p of baseSorted) {
    ;(p.hasReviewer === false ? unassigned : assigned).push(p)
  }
  return [...assigned, ...unassigned]
}

// --- Components ---

function StackRow({
  stack,
  personalLimit,
  showAuthor,
}: {
  stack: PersonStack
  personalLimit: number
  showAuthor?: boolean
}) {
  const colorMode = useContext(ColorModeContext)
  const hovered = useContext(HoveredContext)
  const isOver = stack.prs.length > personalLimit
  const sortedPRs = useMemo(
    () => sortPRs(stack.prs, colorMode),
    [stack.prs, colorMode],
  )

  const rowRef = useRef<HTMLDivElement>(null)

  const isRelated =
    hovered !== null &&
    (stack.login === hovered.author ||
      stack.prs.some((p) => `${p.repo}:${p.number}` === hovered.prKey))

  useEffect(() => {
    if (isRelated && rowRef.current) {
      rowRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [isRelated])

  return (
    <div
      ref={rowRef}
      className={`flex items-center gap-3 py-1.5 transition-colors ${isRelated ? 'bg-accent rounded' : ''}`}
    >
      <div className="flex w-28 shrink-0 items-center gap-2">
        <Avatar className="size-6">
          <AvatarImage
            src={`https://github.com/${stack.login}.png`}
            alt={stack.login}
          />
          <AvatarFallback className="text-[8px]">
            {stack.login.slice(0, 2)}
          </AvatarFallback>
        </Avatar>
        <span className="truncate text-sm">{stack.displayName}</span>
      </div>

      <span
        className={`w-8 shrink-0 text-right font-mono text-sm ${isOver ? 'font-bold text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}
      >
        {stack.prs.length}
      </span>

      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-0.5">
        {sortedPRs.map((pr, i) => (
          <PRBlock
            key={`${pr.repo}:${pr.number}`}
            pr={pr}
            showLimitLine={i === personalLimit && isOver}
            showAuthor={showAuthor}
          />
        ))}
      </div>
    </div>
  )
}

/** memo'd — reads SetHoveredContext + ColorModeContext (both stable during hover).
 *  Dimming is handled by DOM class toggling, not React state. */
const PRBlock = memo(function PRBlock({
  pr,
  showLimitLine,
  showAuthor,
}: {
  pr: StackPR
  showLimitLine: boolean
  showAuthor?: boolean
}) {
  const colorMode = useContext(ColorModeContext)
  const setHovered = useContext(SetHoveredContext)
  const prKey = `${pr.repo}:${pr.number}`
  const ageDays = Math.floor(getAgeDays(pr))
  const { bg, ring, bgFaint } = getBlockColor(pr, colorMode)

  return (
    <>
      {showLimitLine && (
        <div className="mx-0.5 h-5 w-px shrink-0 border-l-2 border-dashed border-red-400" />
      )}
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            data-pr-key={prKey}
            className={`size-4 shrink-0 rounded-full transition-all hover:scale-150 ${pr.hasReviewer ? bg : `ring-[2px] ring-inset ${ring} ${bgFaint}`}`}
            aria-label={`${pr.repo}#${pr.number}`}
            onMouseEnter={() => setHovered({ prKey, author: pr.author })}
            onMouseLeave={() => setHovered(null)}
          />
        </PopoverTrigger>
        <PopoverContent side="top" className="w-72 p-3">
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
            </div>
            <p className="text-muted-foreground truncate text-xs">{pr.title}</p>
            <div className="text-muted-foreground flex flex-wrap gap-x-2 text-xs">
              {showAuthor && <span>by {pr.author}</span>}
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
        </PopoverContent>
      </Popover>
    </>
  )
})

function StackColumn({
  title,
  stacks,
  personalLimit,
  showAuthor,
  unassignedPRs,
}: {
  title: string
  stacks: PersonStack[]
  personalLimit: number
  showAuthor?: boolean
  unassignedPRs?: StackPR[]
}) {
  const hasUnassigned = unassignedPRs && unassignedPRs.length > 0

  if (stacks.length === 0 && !hasUnassigned) {
    return (
      <div>
        <h3 className="text-muted-foreground mb-2 text-sm font-medium">
          {title}
        </h3>
        <p className="text-muted-foreground text-xs">No data</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      <h3 className="text-muted-foreground mb-2 text-sm font-medium">
        {title}
      </h3>
      <div
        className="divide-y overflow-y-auto"
        style={{ maxHeight: 'calc(100vh - 320px)' }}
      >
        {stacks.map((stack) => (
          <StackRow
            key={stack.login}
            stack={stack}
            personalLimit={personalLimit}
            showAuthor={showAuthor}
          />
        ))}
        {hasUnassigned && <UnassignedRows prs={unassignedPRs} />}
      </div>
    </div>
  )
}

function UnassignedRows({ prs }: { prs: StackPR[] }) {
  const colorMode = useContext(ColorModeContext)
  const sortedPRs = useMemo(() => sortPRs(prs, colorMode), [prs, colorMode])

  return (
    <div className="mt-3 border-t-2 border-dashed border-amber-400 pt-2">
      <div className="flex items-center gap-3 py-1.5">
        <span className="w-28 shrink-0 text-sm font-medium text-amber-600 dark:text-amber-400">
          No reviewer
        </span>
        <span className="text-muted-foreground w-8 shrink-0 text-right font-mono text-sm">
          {prs.length}
        </span>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-0.5">
          {sortedPRs.map((pr) => (
            <PRBlock
              key={`${pr.repo}:${pr.number}`}
              pr={pr}
              showLimitLine={false}
              showAuthor
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function Legend({ mode }: { mode: ColorMode }) {
  return (
    <div className="flex items-center gap-3 text-xs">
      {mode === 'size' ? (
        <>
          {PR_SIZE_LABELS.map((label) => (
            <div key={label} className="flex items-center gap-1">
              <div
                className={`size-3 rounded-sm ${SIZE_BLOCK_COLORS[label].bg}`}
              />
              <span className="text-muted-foreground">{label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1">
            <div className={`size-3 rounded-sm ${UNKNOWN_COLOR.bg}`} />
            <span className="text-muted-foreground">?</span>
          </div>
        </>
      ) : (
        AGE_THRESHOLDS.map((t) => (
          <div key={t.label} className="flex items-center gap-1">
            <div className={`size-3 rounded-sm ${t.bg}`} />
            <span className="text-muted-foreground">{t.label}</span>
          </div>
        ))
      )}
      <div className="flex items-center gap-1">
        <div className="h-4 w-px border-l-2 border-dashed border-red-400" />
        <span className="text-muted-foreground">Limit</span>
      </div>
    </div>
  )
}

export function TeamStacksChart({ data }: { data: TeamStacksData }) {
  const {
    authorStacks,
    reviewerStacks,
    unassignedPRs,
    personalLimit,
    insight,
  } = data
  const [searchParams, setSearchParams] = useSearchParams()
  const colorMode: ColorMode =
    searchParams.get('view') === 'size' ? 'size' : 'age'
  const setColorMode = (mode: ColorMode) => {
    setSearchParams((prev) => {
      if (mode === 'age') {
        prev.delete('view')
      } else {
        prev.set('view', mode)
      }
      return prev
    })
  }
  const [hovered, setHovered] = useState<HoveredInfo | null>(null)

  // DOM-based dimming: toggle classes directly to avoid re-rendering ~170 PRBlocks.
  // Matched PRs (same prKey across columns) stay visible + scale up slightly.
  const gridRef = useRef<HTMLDivElement>(null)
  const prevMatches = useRef<Element[]>([])

  const handleHover = useCallback((info: HoveredInfo | null) => {
    // React state for row highlighting (StackRow reads HoveredContext)
    setHovered(info)

    // Direct DOM manipulation for PR block dimming (zero re-renders)
    const grid = gridRef.current
    if (!grid) return

    // Clean up previous matches
    for (const el of prevMatches.current) {
      el.classList.remove('pr-match')
    }
    prevMatches.current = []

    if (info) {
      grid.classList.add('pr-hovering')
      const matches = grid.querySelectorAll(`[data-pr-key="${info.prKey}"]`)
      for (const el of matches) {
        el.classList.add('pr-match')
      }
      prevMatches.current = Array.from(matches)
    } else {
      grid.classList.remove('pr-hovering')
    }
  }, [])

  return (
    <SetHoveredContext value={handleHover}>
      <HoveredContext value={hovered}>
        <ColorModeContext value={colorMode}>
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <p className="text-muted-foreground text-sm">
                  Each block = 1 open PR. The dashed line marks the personal
                  limit ({personalLimit}). Blocks past the line signal
                  individual overload.
                </p>
                <Legend mode={colorMode} />
              </div>
              <ToggleGroup
                type="single"
                variant="outline"
                value={colorMode}
                onValueChange={(v) => {
                  if (v) setColorMode(v as ColorMode)
                }}
                size="sm"
                className="shrink-0"
              >
                <ToggleGroupItem value="age">Age</ToggleGroupItem>
                <ToggleGroupItem value="size">Size</ToggleGroupItem>
              </ToggleGroup>
            </div>
            {/* Dimming via DOM classes: .pr-hovering dims all buttons,
                .pr-match + :hover exclude the matched/hovered ones */}
            <div
              ref={gridRef}
              className="grid gap-8 md:grid-cols-2 [&.pr-hovering_.pr-match:not(:hover)]:scale-125 [&.pr-hovering_button:not(.pr-match):not(:hover)]:opacity-15"
            >
              <StackColumn
                title="Authored PRs (open)"
                stacks={authorStacks}
                personalLimit={personalLimit}
              />
              <StackColumn
                title="Review Queue (pending)"
                stacks={reviewerStacks}
                personalLimit={personalLimit}
                showAuthor
                unassignedPRs={unassignedPRs}
              />
            </div>
            {insight && (
              <p className="text-muted-foreground text-center text-sm">
                {insight}
              </p>
            )}
          </div>
        </ColorModeContext>
      </HoveredContext>
    </SetHoveredContext>
  )
}
