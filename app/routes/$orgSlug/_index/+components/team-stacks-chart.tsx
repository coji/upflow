import {
  createContext,
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
import type {
  PersonStack,
  StackPR,
  TeamStacksData,
} from '../+functions/aggregate-stacks'
import { SizeBadge } from '../../+components/size-badge'

type ColorMode = 'size' | 'age'

// --- Size mode ---

const SIZE_ORDER = ['XL', 'L', 'M', 'S', 'XS'] as const

const SIZE_BLOCK_COLORS: Record<
  string,
  { bg: string; ring: string; bgFaint: string }
> = {
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
  L: { bg: 'bg-amber-500', ring: 'ring-amber-500', bgFaint: 'bg-amber-500/20' },
  XL: { bg: 'bg-red-500', ring: 'ring-red-500', bgFaint: 'bg-red-500/20' },
}

const UNKNOWN_COLOR = {
  bg: 'bg-gray-300 dark:bg-gray-600',
  ring: 'ring-gray-400',
  bgFaint: 'bg-gray-400/20',
}

function getSizeColor(complexity: string | null): {
  bg: string
  ring: string
  bgFaint: string
} {
  if (!complexity) return UNKNOWN_COLOR
  return SIZE_BLOCK_COLORS[complexity] ?? UNKNOWN_COLOR
}

function sortBySize(prs: StackPR[]): StackPR[] {
  return [...prs].sort((a, b) => {
    const ai = SIZE_ORDER.indexOf(
      (a.complexity ?? '') as (typeof SIZE_ORDER)[number],
    )
    const bi = SIZE_ORDER.indexOf(
      (b.complexity ?? '') as (typeof SIZE_ORDER)[number],
    )
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
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

function getAgeColor(pr: StackPR): {
  bg: string
  ring: string
  bgFaint: string
} {
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

// --- Shared context ---

interface HoveredInfo {
  prKey: string
  author: string
}

const ChartContext = createContext<{
  hovered: HoveredInfo | null
  setHovered: (info: HoveredInfo | null) => void
  colorMode: ColorMode
}>({ hovered: null, setHovered: () => {}, colorMode: 'size' })

function getBlockColor(
  pr: StackPR,
  mode: ColorMode,
): { bg: string; ring: string; bgFaint: string } {
  return mode === 'size' ? getSizeColor(pr.complexity) : getAgeColor(pr)
}

function sortPRs(prs: StackPR[], mode: ColorMode): StackPR[] {
  const baseSorted = mode === 'size' ? sortBySize(prs) : sortByAge(prs)
  // Push unassigned PRs to the end, preserving sort order within each group
  const assigned = baseSorted.filter((p) => p.hasReviewer !== false)
  const unassigned = baseSorted.filter((p) => p.hasReviewer === false)
  return [...assigned, ...unassigned]
}

// --- Components ---

function StackRow({
  stack,
  wipLimit,
  showAuthor,
}: {
  stack: PersonStack
  wipLimit: number
  showAuthor?: boolean
}) {
  const { colorMode, hovered } = useContext(ChartContext)
  const isOver = stack.prs.length > wipLimit
  const sortedPRs = sortPRs(stack.prs, colorMode)

  const rowRef = useRef<HTMLDivElement>(null)

  // Highlight this row if the hovered PR belongs to this person (author side)
  // or this person's queue contains the hovered PR (reviewer side)
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
            showWipLine={i === wipLimit && isOver}
            showAuthor={showAuthor}
          />
        ))}
      </div>
    </div>
  )
}

function PRBlock({
  pr,
  showWipLine,
  showAuthor,
}: {
  pr: StackPR
  showWipLine: boolean
  showAuthor?: boolean
}) {
  const { hovered, setHovered, colorMode } = useContext(ChartContext)
  const prKey = `${pr.repo}:${pr.number}`
  const isDimmed = hovered !== null && hovered.prKey !== prKey
  const ageDays = Math.floor(getAgeDays(pr))

  return (
    <>
      {showWipLine && (
        <div className="mx-0.5 h-5 w-px shrink-0 border-l-2 border-dashed border-red-400" />
      )}
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={`size-4 shrink-0 rounded-full transition-all hover:scale-150 ${isDimmed ? 'opacity-15' : ''} ${pr.hasReviewer ? getBlockColor(pr, colorMode).bg : `ring-[2px] ring-inset ${getBlockColor(pr, colorMode).ring} ${getBlockColor(pr, colorMode).bgFaint}`}`}
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
}

function StackColumn({
  title,
  stacks,
  wipLimit,
  showAuthor,
  unassignedPRs,
}: {
  title: string
  stacks: PersonStack[]
  wipLimit: number
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
            wipLimit={wipLimit}
            showAuthor={showAuthor}
          />
        ))}
        {hasUnassigned && <UnassignedRows prs={unassignedPRs} />}
      </div>
    </div>
  )
}

function UnassignedRows({ prs }: { prs: StackPR[] }) {
  const { colorMode } = useContext(ChartContext)
  const sortedPRs = sortPRs(prs, colorMode)

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
              showWipLine={false}
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
          {[...SIZE_ORDER].reverse().map((label) => (
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
        <span className="text-muted-foreground">WIP limit</span>
      </div>
    </div>
  )
}

export function TeamStacksChart({ data }: { data: TeamStacksData }) {
  const { authorStacks, reviewerStacks, unassignedPRs, wipLimit, insight } =
    data
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
  const ctxValue = useMemo(
    () => ({ hovered, setHovered, colorMode }),
    [hovered, colorMode],
  )

  return (
    <ChartContext value={ctxValue}>
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-muted-foreground text-sm">
              Each block = 1 open PR. The dashed line marks the WIP limit (
              {wipLimit}). Blocks past the line are excess WIP adding to
              everyone&apos;s review burden.
            </p>
            <Legend mode={colorMode} />
          </div>
          <ToggleGroup
            type="single"
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
        <div className="grid gap-8 md:grid-cols-2">
          <StackColumn
            title="Authored PRs (open)"
            stacks={authorStacks}
            wipLimit={wipLimit}
          />
          <StackColumn
            title="Review Queue (pending)"
            stacks={reviewerStacks}
            wipLimit={wipLimit}
            showAuthor
            unassignedPRs={unassignedPRs}
          />
        </div>
        {insight && (
          <p className="text-muted-foreground text-center text-sm">{insight}</p>
        )}
      </div>
    </ChartContext>
  )
}
