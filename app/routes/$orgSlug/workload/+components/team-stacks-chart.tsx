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
import { Link, href, useParams, useSearchParams } from 'react-router'
import { Avatar, AvatarFallback, AvatarImage } from '~/app/components/ui/avatar'
import { ToggleGroup, ToggleGroupItem } from '~/app/components/ui/toggle-group'
import dayjs from '~/app/libs/dayjs'
import { PR_SIZE_LABELS, PR_SIZE_RANK } from '~/app/libs/pr-classify'
import type {
  PersonStack,
  StackPR,
  TeamStacksData,
} from '../+functions/aggregate-stacks'
import {
  AGE_THRESHOLDS,
  PRBlock as PRBlockBase,
  REVIEW_STATUS_PRIORITY,
  REVIEW_STATUS_SHAPE,
  SIZE_BLOCK_COLORS,
  UNKNOWN_COLOR,
  type PRBlockColorMode as ColorMode,
  type PRReviewStatus,
} from '../../+components/pr-block'

function sortBySize(prs: StackPR[]): StackPR[] {
  return [...prs].sort((a, b) => {
    const ai = PR_SIZE_RANK[a.complexity ?? ''] ?? 99
    const bi = PR_SIZE_RANK[b.complexity ?? ''] ?? 99
    return bi - ai
  })
}

// --- Age mode ---

function getAgeDays(pr: StackPR): number {
  return dayjs().diff(dayjs.utc(pr.createdAt), 'day', true)
}

function sortByAge(prs: StackPR[]): StackPR[] {
  const withAge = prs.map((pr) => ({ pr, age: getAgeDays(pr) }))
  withAge.sort((a, b) => b.age - a.age)
  return withAge.map(({ pr }) => pr)
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
interface SelectedInfo {
  prKey: string
  author: string
  // Incremented on every click so re-clicking the same PR re-triggers scroll.
  tick: number
}
const SelectedContext = createContext<SelectedInfo | null>(null)
const SetSelectedContext = createContext<
  (
    e: React.MouseEvent<HTMLButtonElement>,
    prKey: string,
    author: string,
  ) => void
>(() => {})
const ColorModeContext = createContext<ColorMode>('age')

function sortPRs(prs: StackPR[], mode: ColorMode): StackPR[] {
  const baseSorted = mode === 'size' ? sortBySize(prs) : sortByAge(prs)
  return [...baseSorted].sort((a, b) => {
    const pa = REVIEW_STATUS_PRIORITY[a.reviewStatus ?? 'in-review'] ?? 3
    const pb = REVIEW_STATUS_PRIORITY[b.reviewStatus ?? 'in-review'] ?? 3
    return pa - pb
  })
}

// --- Scroll helper ---
// Scrolls only the column's overflow-y-auto container, never parent/page.
// Skips scrolling if the click originated in the same column (already visible).
const SelectedSourceColumnContext = createContext<HTMLElement | null>(null)

function useScrollIntoColumn(
  ref: React.RefObject<HTMLDivElement | null>,
  active: boolean,
  tick: number,
) {
  const sourceColumn = useContext(SelectedSourceColumnContext)

  // biome-ignore lint/correctness/useExhaustiveDependencies: tick is intentional — re-clicking the same PR must re-run the effect.
  useEffect(() => {
    const row = ref.current
    if (!active || !row) return
    const container = row.closest('.overflow-y-auto') as HTMLElement | null
    if (!container) return
    // Don't scroll if the click originated from the same column
    if (sourceColumn === container) return
    const rafId = requestAnimationFrame(() => {
      const cRect = container.getBoundingClientRect()
      const rRect = row.getBoundingClientRect()
      if (rRect.top < cRect.top) {
        container.scrollBy({
          top: rRect.top - cRect.top - 4,
          behavior: 'smooth',
        })
      } else if (rRect.bottom > cRect.bottom) {
        container.scrollBy({
          top: rRect.bottom - cRect.bottom + 4,
          behavior: 'smooth',
        })
      }
    })
    return () => cancelAnimationFrame(rafId)
  }, [ref, active, sourceColumn, tick])
}

// --- Components ---

function MemberLink({
  login,
  displayName,
}: {
  login: string
  displayName: string
}) {
  const { orgSlug } = useParams()
  const [searchParams] = useSearchParams()
  if (!orgSlug) throw new Error('MemberLink requires orgSlug param')
  const query = searchParams.toString()
  const basePath = href('/:orgSlug/workload/:login', { orgSlug, login })
  const linkTo = query ? `${basePath}?${query}` : basePath
  return (
    <Link
      to={linkTo}
      className="flex w-28 shrink-0 items-center gap-2 hover:underline"
    >
      <Avatar className="size-6">
        <AvatarImage src={`https://github.com/${login}.png`} alt={login} />
        <AvatarFallback className="text-[8px]">
          {login.slice(0, 2)}
        </AvatarFallback>
      </Avatar>
      <span className="truncate text-sm">{displayName}</span>
    </Link>
  )
}

function StackRow({
  stack,
  personalLimit,
}: {
  stack: PersonStack
  personalLimit: number
}) {
  const colorMode = useContext(ColorModeContext)
  const hovered = useContext(HoveredContext)
  const selected = useContext(SelectedContext)
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

  const isSelectedRelated =
    selected !== null &&
    (stack.login === selected.author ||
      stack.prs.some((p) => `${p.repo}:${p.number}` === selected.prKey))

  useScrollIntoColumn(rowRef, isSelectedRelated, selected?.tick ?? 0)

  return (
    <div
      ref={rowRef}
      className={`flex items-center gap-3 py-1.5 transition-colors ${isRelated ? 'bg-accent rounded' : ''}`}
    >
      <MemberLink login={stack.login} displayName={stack.displayName} />

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
}: {
  pr: StackPR
  showLimitLine: boolean
}) {
  const colorMode = useContext(ColorModeContext)
  const setHovered = useContext(SetHoveredContext)
  const setSelected = useContext(SetSelectedContext)
  const prKey = `${pr.repo}:${pr.number}`

  return (
    <>
      {showLimitLine && (
        <div className="mx-0.5 h-5 w-px shrink-0 border-l-2 border-dashed border-red-400" />
      )}
      <PRBlockBase
        pr={{
          number: pr.number,
          repo: pr.repo,
          title: pr.title,
          url: pr.url,
          author: pr.author,
          authorDisplayName: pr.authorDisplayName,
          createdAt: pr.createdAt,
          complexity: pr.complexity,
          reviewStatus: pr.reviewStatus,
          reviewerStates: pr.reviewerStates,
        }}
        colorMode={colorMode}
        dataPrKey={prKey}
        onMouseEnter={() => setHovered({ prKey, author: pr.author })}
        onMouseLeave={() => setHovered(null)}
        onClick={(e) => setSelected(e, prKey, pr.author)}
      />
    </>
  )
})

interface BucketConfig {
  key: PRReviewStatus
  label: string
  prs: StackPR[]
  /** Tailwind text color for label pill */
  labelColor: string
  /** Tailwind bg for label pill */
  pillBg: string
}

function StackColumn({
  title,
  stacks,
  personalLimit,
  buckets,
}: {
  title: string
  stacks: PersonStack[]
  personalLimit: number
  buckets?: BucketConfig[]
}) {
  const activeBuckets = buckets?.filter((b) => b.prs.length > 0) ?? []
  const hasBuckets = activeBuckets.length > 0

  if (stacks.length === 0 && !hasBuckets) {
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
          />
        ))}
        {activeBuckets.map((bucket) => (
          <BucketRow
            key={bucket.key}
            label={bucket.label}
            prs={bucket.prs}
            labelColor={bucket.labelColor}
            pillBg={bucket.pillBg}
          />
        ))}
      </div>
    </div>
  )
}

function BucketRow({
  label,
  prs,
  labelColor,
  pillBg,
}: {
  label: string
  prs: StackPR[]
  labelColor: string
  pillBg: string
}) {
  const colorMode = useContext(ColorModeContext)
  const hovered = useContext(HoveredContext)
  const selected = useContext(SelectedContext)
  const sortedPRs = useMemo(() => sortPRs(prs, colorMode), [prs, colorMode])
  const rowRef = useRef<HTMLDivElement>(null)

  const isRelated =
    hovered !== null &&
    prs.some((p) => `${p.repo}:${p.number}` === hovered.prKey)

  const isSelectedRelated =
    selected !== null &&
    prs.some((p) => `${p.repo}:${p.number}` === selected.prKey)

  useScrollIntoColumn(rowRef, isSelectedRelated, selected?.tick ?? 0)

  return (
    <div
      ref={rowRef}
      className={`mt-2 pt-1 transition-colors ${isRelated ? 'bg-accent rounded' : ''}`}
    >
      <div className="flex items-center gap-3 py-1.5">
        <span
          className={`inline-flex w-28 shrink-0 items-center justify-center rounded-full px-2 py-0.5 text-xs font-medium ${pillBg} ${labelColor}`}
        >
          {label}
          <span className="text-muted-foreground ml-1 font-mono">
            {prs.length}
          </span>
        </span>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-0.5">
          {sortedPRs.map((pr) => (
            <PRBlock
              key={`${pr.repo}:${pr.number}`}
              pr={pr}
              showLimitLine={false}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

const SHAPE_LEGEND_ENTRIES = [
  REVIEW_STATUS_SHAPE['in-review'],
  REVIEW_STATUS_SHAPE['approved-awaiting-merge'],
  REVIEW_STATUS_SHAPE['changes-pending'],
  REVIEW_STATUS_SHAPE.unassigned,
]

function Legend({ mode }: { mode: ColorMode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
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
      <div className="text-muted-foreground">|</div>
      {SHAPE_LEGEND_ENTRIES.map((entry) => (
        <div key={entry.label} className="flex items-center gap-1">
          <div
            className={`flex items-center justify-center ${entry.legendSwatch}`}
          >
            {entry.icon && (
              <span className="text-[7px] leading-none font-bold text-gray-500 dark:text-gray-400">
                {entry.icon}
              </span>
            )}
          </div>
          <span className="text-muted-foreground">{entry.label}</span>
        </div>
      ))}
    </div>
  )
}

export function TeamStacksChart({ data }: { data: TeamStacksData }) {
  const {
    authorStacks,
    reviewerStacks,
    unassignedPRs,
    approvedAwaitingMergePRs,
    changesPendingPRs,
    personalLimit,
    insight,
    autoMergeSuggestion,
  } = data
  const reviewQueueBuckets: BucketConfig[] = [
    {
      key: 'approved-awaiting-merge',
      label: 'Approved',
      prs: approvedAwaitingMergePRs,
      labelColor: 'text-emerald-700 dark:text-emerald-400',
      pillBg: 'bg-emerald-100 dark:bg-emerald-950',
    },
    {
      key: 'changes-pending',
      label: 'Changes',
      prs: changesPendingPRs,
      labelColor: 'text-amber-700 dark:text-amber-400',
      pillBg: 'bg-amber-50 dark:bg-amber-950/50',
    },
    {
      key: 'unassigned',
      label: 'Unassigned',
      prs: unassignedPRs,
      labelColor: 'text-amber-700 dark:text-amber-400',
      pillBg: 'bg-amber-100 dark:bg-amber-950',
    },
  ]
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
  const [selected, setSelected] = useState<SelectedInfo | null>(null)
  const [selectedSourceColumn, setSelectedSourceColumn] =
    useState<HTMLElement | null>(null)

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

  const handleSelect = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>, prKey: string, author: string) => {
      const sourceCol = e.currentTarget.closest(
        '.overflow-y-auto',
      ) as HTMLElement | null
      setSelectedSourceColumn(sourceCol)
      setSelected((prev) => ({ prKey, author, tick: (prev?.tick ?? 0) + 1 }))
    },
    [],
  )

  return (
    <SetHoveredContext value={handleHover}>
      <HoveredContext value={hovered}>
        <SetSelectedContext value={handleSelect}>
          <SelectedContext value={selected}>
            <ColorModeContext value={colorMode}>
              <SelectedSourceColumnContext value={selectedSourceColumn}>
                <div className="space-y-4">
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
                      buckets={reviewQueueBuckets}
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                    <div className="flex items-center gap-3">
                      <ToggleGroup
                        type="single"
                        value={colorMode}
                        onValueChange={(v) => {
                          if (v) setColorMode(v as ColorMode)
                        }}
                        size="sm"
                        className="bg-muted shrink-0 rounded-lg p-0.5"
                      >
                        <ToggleGroupItem
                          value="age"
                          className="data-[state=on]:bg-background rounded-md data-[state=on]:shadow-sm"
                        >
                          Age
                        </ToggleGroupItem>
                        <ToggleGroupItem
                          value="size"
                          className="data-[state=on]:bg-background rounded-md data-[state=on]:shadow-sm"
                        >
                          Size
                        </ToggleGroupItem>
                      </ToggleGroup>
                      <Legend mode={colorMode} />
                    </div>
                    <p className="text-muted-foreground text-xs">
                      1 block = 1 PR. Dashed line = personal limit (
                      {personalLimit}
                      ).
                    </p>
                  </div>
                  {insight && (
                    <p
                      className={`text-center text-sm ${autoMergeSuggestion ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground'}`}
                    >
                      {insight}
                    </p>
                  )}
                </div>
              </SelectedSourceColumnContext>
            </ColorModeContext>
          </SelectedContext>
        </SetSelectedContext>
      </HoveredContext>
    </SetHoveredContext>
  )
}
