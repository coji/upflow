import { createContext, useContext, useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '~/app/components/ui/avatar'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/app/components/ui/card'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/app/components/ui/popover'
import type {
  PersonStack,
  StackPR,
  TeamStacksData,
} from '../+functions/aggregate-stacks'
import { SizeBadge } from '../../+components/size-badge'

const SIZE_BLOCK_COLORS: Record<string, string> = {
  XS: 'bg-slate-400',
  S: 'bg-emerald-500',
  M: 'bg-blue-500',
  L: 'bg-amber-500',
  XL: 'bg-red-500',
}

function getBlockColor(complexity: string | null): string {
  if (!complexity) return 'bg-gray-300 dark:bg-gray-600'
  return SIZE_BLOCK_COLORS[complexity] ?? 'bg-gray-300 dark:bg-gray-600'
}

const HoverContext = createContext<{
  hoveredPR: string | null
  setHoveredPR: (key: string | null) => void
}>({ hoveredPR: null, setHoveredPR: () => {} })

function StackRow({
  stack,
  wipLimit,
  showAuthor,
}: {
  stack: PersonStack
  wipLimit: number
  showAuthor?: boolean
}) {
  const isOver = stack.prs.length > wipLimit

  // Sort PRs by size (XL first) so big ones are visually prominent
  const sortedPRs = [...stack.prs].sort((a, b) => {
    const order = ['XL', 'L', 'M', 'S', 'XS']
    const ai = order.indexOf(a.complexity ?? '')
    const bi = order.indexOf(b.complexity ?? '')
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })

  return (
    <div className="flex items-center gap-3 py-1.5">
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
  const { hoveredPR, setHoveredPR } = useContext(HoverContext)
  const prKey = `${pr.repo}:${pr.number}`
  const isDimmed = hoveredPR !== null && hoveredPR !== prKey

  return (
    <>
      {showWipLine && (
        <div className="mx-0.5 h-5 w-px shrink-0 border-l-2 border-dashed border-red-400" />
      )}
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={`size-4 shrink-0 transition-all hover:scale-150 ${getBlockColor(pr.complexity)} ${isDimmed ? 'opacity-15' : ''} ${pr.hasReviewer ? 'rounded-full' : 'rotate-45 rounded-sm'}`}
            aria-label={`${pr.repo}#${pr.number}`}
            onMouseEnter={() => setHoveredPR(prKey)}
            onMouseLeave={() => setHoveredPR(null)}
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
            {showAuthor && (
              <p className="text-muted-foreground text-xs">by {pr.author}</p>
            )}
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
          {[...prs]
            .sort((a, b) => {
              const order = ['XL', 'L', 'M', 'S', 'XS']
              const ai = order.indexOf(a.complexity ?? '')
              const bi = order.indexOf(b.complexity ?? '')
              return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
            })
            .map((pr) => (
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

function SizeLegend() {
  const sizes = [
    { label: 'XS', color: 'bg-slate-400' },
    { label: 'S', color: 'bg-emerald-500' },
    { label: 'M', color: 'bg-blue-500' },
    { label: 'L', color: 'bg-amber-500' },
    { label: 'XL', color: 'bg-red-500' },
    { label: '?', color: 'bg-gray-300 dark:bg-gray-600' },
  ]

  return (
    <div className="flex items-center gap-3 text-xs">
      {sizes.map((s) => (
        <div key={s.label} className="flex items-center gap-1">
          <div className={`size-3 rounded-sm ${s.color}`} />
          <span className="text-muted-foreground">{s.label}</span>
        </div>
      ))}
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
  const [hoveredPR, setHoveredPR] = useState<string | null>(null)

  return (
    <HoverContext value={{ hoveredPR, setHoveredPR }}>
      <Card>
        <CardHeader>
          <CardTitle>Team Review Stacks</CardTitle>
          <CardDescription>
            Each block = 1 open PR, colored by size. The dashed line marks the
            WIP limit ({wipLimit}). Blocks past the line are excess WIP adding
            to everyone&apos;s review burden.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SizeLegend />
          <div className="mt-4 grid gap-8 md:grid-cols-2">
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
            <p className="text-muted-foreground mt-4 text-center text-sm">
              {insight}
            </p>
          )}
        </CardContent>
      </Card>
    </HoverContext>
  )
}
