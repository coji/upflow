import holiday_jp from '@holiday-jp/holiday_jp'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Avatar, AvatarFallback, AvatarImage } from '~/app/components/ui/avatar'
import { Button } from '~/app/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/app/components/ui/popover'
import { HStack, Stack } from '~/app/components/ui/stack'
import { ToggleGroup, ToggleGroupItem } from '~/app/components/ui/toggle-group'
import { requireOrgMember } from '~/app/libs/auth.server'
import { getEndOfWeek, getStartOfWeek } from '~/app/libs/date-utils'
import dayjs from '~/app/libs/dayjs'
import {
  PRBlock,
  PRPopoverContent,
  REVIEW_STATE_STYLE,
  type PRBlockData,
} from '~/app/routes/$orgSlug/+components/pr-block'
import { SizeBadge } from '~/app/routes/$orgSlug/+components/size-badge'
import { PR_SIZE_RANK } from '~/app/routes/$orgSlug/reviews/+functions/classify'
import {
  getBacklogDetails,
  getCreatedPRs,
  getMergedPRs,
  getReviewsSubmitted,
  getUserProfile,
} from './+functions/queries.server'
import type { Route } from './+types/index'

export const loader = async ({ request, params }: Route.LoaderArgs) => {
  const { organization } = await requireOrgMember(request, params.orgSlug)

  const url = new URL(request.url)
  const weekParam = url.searchParams.get('week')

  const weekStart = weekParam
    ? getStartOfWeek(dayjs(weekParam, 'YYYY-MM-DD').toDate())
    : getStartOfWeek()
  const weekEnd = getEndOfWeek(weekStart.toDate())
  const from = weekStart.utc().toISOString()
  const to = weekEnd.utc().toISOString()

  const [user, createdPRs, mergedPRs, reviews, backlog] = await Promise.all([
    getUserProfile(organization.id, params.login),
    getCreatedPRs(organization.id, params.login, from, to),
    getMergedPRs(organization.id, params.login, from, to),
    getReviewsSubmitted(organization.id, params.login, from, to),
    getBacklogDetails(organization.id, params.login),
  ])

  // Build holiday map for the week
  const holidays: Record<string, string> = {}
  for (const h of holiday_jp.between(weekStart.toDate(), weekEnd.toDate())) {
    holidays[dayjs(h.date).format('YYYY-MM-DD')] = h.name
  }

  return {
    user,
    createdPRs,
    mergedPRs,
    reviews,
    backlog,
    holidays,
    weekStart: weekStart.format('YYYY-MM-DD'),
    weekEnd: weekEnd.format('YYYY-MM-DD'),
  }
}

export default function MemberWeeklyPage({
  loaderData: {
    user,
    createdPRs,
    mergedPRs,
    reviews,
    backlog,
    holidays,
    weekStart,
    weekEnd,
  },
  params,
}: Route.ComponentProps) {
  const [searchParams, setSearchParams] = useSearchParams()

  const colorMode = searchParams.get('view') === 'size' ? 'size' : 'age'
  const setColorMode = (mode: string) => {
    setSearchParams((prev) => {
      if (mode === 'age') {
        prev.delete('view')
      } else {
        prev.set('view', mode)
      }
      return prev
    })
  }

  const viewParam = searchParams.get('view')
  const backQuery = viewParam ? `?view=${viewParam}` : ''

  const prevWeek = dayjs(weekStart).subtract(7, 'day').format('YYYY-MM-DD')
  const nextWeek = dayjs(weekStart).add(7, 'day').format('YYYY-MM-DD')
  const isCurrentWeek = dayjs(weekStart).isSame(getStartOfWeek(), 'day')

  // Sort backlog PRs by color mode (assigned first, then by age or size)
  const sortBacklog = useMemo(() => {
    return <
      T extends {
        complexity: string | null
        pullRequestCreatedAt: string
        hasReviewer?: boolean
      },
    >(
      prs: T[],
    ): T[] => {
      const sorted = [...prs].sort((a, b) => {
        if (colorMode === 'size') {
          const ai = PR_SIZE_RANK[a.complexity ?? ''] ?? 99
          const bi = PR_SIZE_RANK[b.complexity ?? ''] ?? 99
          return bi - ai
        }
        return (
          dayjs().diff(dayjs(b.pullRequestCreatedAt), 'day', true) -
          dayjs().diff(dayjs(a.pullRequestCreatedAt), 'day', true)
        )
      })
      const assigned = sorted.filter((p) => p.hasReviewer !== false)
      const unassigned = sorted.filter((p) => p.hasReviewer === false)
      return [...assigned, ...unassigned]
    }
  }, [colorMode])

  const sortedOpenPRs = useMemo(
    () => sortBacklog(backlog.openPRs),
    [sortBacklog, backlog.openPRs],
  )

  const sortedPendingReviews = useMemo(
    () => sortBacklog(backlog.pendingReviews),
    [sortBacklog, backlog.pendingReviews],
  )

  // Group activities by day of week (Mon=0 .. Sun=6)
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = dayjs(weekStart).add(i, 'day')
    const dateStr = date.format('YYYY-MM-DD')
    return {
      date,
      dateStr,
      label: date.format('ddd'),
      dayNum: date.format('M/D'),
      holiday: holidays[dateStr] ?? null,
      created: createdPRs.filter(
        (pr) => dayjs(pr.pullRequestCreatedAt).format('YYYY-MM-DD') === dateStr,
      ),
      merged: mergedPRs.filter(
        (pr) => dayjs(pr.mergedAt).format('YYYY-MM-DD') === dateStr,
      ),
      reviewed: reviews.filter(
        (r) => dayjs(r.submittedAt).format('YYYY-MM-DD') === dateStr,
      ),
    }
  })

  const weekLabel = `${dayjs(weekStart).format('YYYY/M/D')} - ${dayjs(weekEnd).format('M/D')}`

  return (
    <Stack>
      {/* Header */}
      <div className="flex items-center justify-between">
        <HStack>
          <Link
            to={`/${params.orgSlug}/stacks${backQuery}`}
            className="text-muted-foreground hover:text-foreground text-sm"
          >
            ← Review Stacks
          </Link>
        </HStack>
      </div>

      <HStack>
        <Avatar className="size-10">
          <AvatarImage
            src={`https://github.com/${user.login}.png`}
            alt={user.login}
          />
          <AvatarFallback>{user.login.slice(0, 2)}</AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-xl font-bold">{user.displayName}</h1>
          <p className="text-muted-foreground text-sm">
            {user.login}
            <span className="mx-1.5">·</span>
            Open PRs {backlog.openPRs.length}
            <span className="mx-1.5">·</span>
            Review Queue {backlog.pendingReviews.length}
          </p>
        </div>
      </HStack>

      {/* Current Load - like Review Stacks drill-down */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-muted-foreground text-sm font-medium">
            Current Load
          </h2>
          <ToggleGroup
            type="single"
            value={colorMode}
            onValueChange={(v) => {
              if (v) setColorMode(v)
            }}
            size="sm"
            className="bg-muted rounded-lg p-0.5"
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
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <BlockRow label="Authored" count={sortedOpenPRs.length}>
            {sortedOpenPRs.map((pr) => (
              <PRBlock
                key={`${pr.repositoryId}:${pr.number}`}
                colorMode={colorMode}
                pr={{
                  number: pr.number,
                  repo: pr.repo,
                  title: pr.title,
                  url: pr.url,
                  createdAt: pr.pullRequestCreatedAt,
                  complexity: pr.complexity,
                  hasReviewer: pr.hasReviewer,
                }}
              />
            ))}
          </BlockRow>
          <BlockRow label="Review Queue" count={sortedPendingReviews.length}>
            {sortedPendingReviews.map((pr) => (
              <PRBlock
                key={`${pr.repositoryId}:${pr.number}`}
                colorMode={colorMode}
                pr={{
                  number: pr.number,
                  repo: pr.repo,
                  title: pr.title,
                  url: pr.url,
                  author: pr.author,
                  createdAt: pr.pullRequestCreatedAt,
                  complexity: pr.complexity,
                }}
                showAuthor
              />
            ))}
          </BlockRow>
        </div>
      </div>

      <hr className="border-border" />

      {/* Weekly activity header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-muted-foreground text-sm font-medium">
            This Week
          </h2>
          <div className="text-muted-foreground flex gap-3 text-xs">
            <span>
              <span className="inline-block size-2 rounded-full bg-blue-500" />{' '}
              Created {createdPRs.length}
            </span>
            <span>
              <span className="inline-block size-2 rounded-full bg-emerald-500" />{' '}
              Merged {mergedPRs.length}
            </span>
            <span>
              <span className="inline-block size-2 rounded-full bg-purple-500" />{' '}
              Reviewed {reviews.length}
            </span>
          </div>
        </div>

        <HStack>
          <Button
            variant="outline"
            size="icon"
            className="size-7"
            onClick={() =>
              setSearchParams((prev) => {
                prev.set('week', prevWeek)
                return prev
              })
            }
          >
            <ChevronLeftIcon className="size-4" />
          </Button>
          <span className="min-w-32 text-center text-sm font-medium">
            {weekLabel}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="size-7"
            disabled={isCurrentWeek}
            onClick={() =>
              setSearchParams((prev) => {
                prev.set('week', nextWeek)
                return prev
              })
            }
          >
            <ChevronRightIcon className="size-4" />
          </Button>
        </HStack>
      </div>

      {/* Daily calendar */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const isOff =
            day.date.day() === 0 || day.date.day() === 6 || day.holiday !== null
          const total =
            day.created.length + day.merged.length + day.reviewed.length
          return (
            <div
              key={day.dateStr}
              className={`flex flex-col overflow-hidden rounded-lg border p-2 ${isOff ? 'bg-muted/50' : ''}`}
            >
              <div className="mb-2 text-center">
                <div
                  className={`text-xs ${day.holiday ? 'text-red-500' : 'text-muted-foreground'}`}
                >
                  {day.label}
                </div>
                <div
                  className={`text-sm font-medium ${day.holiday ? 'text-red-500' : ''}`}
                >
                  {day.dayNum}
                </div>
                {day.holiday && (
                  <div className="text-[9px] text-red-400">{day.holiday}</div>
                )}
              </div>
              {total === 0 ? (
                <div className="text-muted-foreground flex-1 py-2 text-center text-xs">
                  -
                </div>
              ) : (
                <div className="space-y-1.5">
                  {day.created.map((pr) => (
                    <CalendarItem
                      key={`c-${pr.repositoryId}:${pr.number}`}
                      color="bg-blue-500"
                      label={`#${pr.number}`}
                      title={pr.title}
                      complexity={pr.complexity}
                      prData={{
                        number: pr.number,
                        repo: pr.repo,
                        title: pr.title,
                        url: pr.url,
                        createdAt: pr.pullRequestCreatedAt,
                        complexity: pr.complexity,
                      }}
                    />
                  ))}
                  {day.merged.map((pr) => (
                    <CalendarItem
                      key={`m-${pr.repositoryId}:${pr.number}`}
                      color="bg-emerald-500"
                      label={`#${pr.number}`}
                      title={pr.title}
                      complexity={pr.complexity}
                      prData={{
                        number: pr.number,
                        repo: pr.repo,
                        title: pr.title,
                        url: pr.url,
                        createdAt: pr.pullRequestCreatedAt,
                        complexity: pr.complexity,
                      }}
                    />
                  ))}
                  {day.reviewed.map((r) => (
                    <CalendarItem
                      key={`r-${r.repositoryId}:${r.number}:${r.submittedAt}`}
                      color="bg-purple-500"
                      label={`#${r.number}`}
                      title={r.title}
                      complexity={r.complexity}
                      prData={{
                        number: r.number,
                        repo: r.repo,
                        title: r.title,
                        url: r.url,
                        author: r.author,
                        createdAt: r.submittedAt,
                        complexity: r.complexity,
                      }}
                      showAuthor
                      reviewState={r.state}
                      suffix={
                        r.state === 'APPROVED'
                          ? '✓'
                          : r.state === 'CHANGES_REQUESTED'
                            ? '✗'
                            : '💬'
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Detail sections */}
      {createdPRs.length > 0 && (
        <DetailSection
          label="Created"
          count={createdPRs.length}
          color="bg-blue-500"
        >
          {createdPRs.map((pr) => (
            <PRRow
              key={`${pr.repositoryId}:${pr.number}`}
              repo={pr.repo}
              number={pr.number}
              title={pr.title}
              url={pr.url}
              complexity={pr.complexity}
              date={dayjs(pr.pullRequestCreatedAt).format('M/D HH:mm')}
            />
          ))}
        </DetailSection>
      )}

      {mergedPRs.length > 0 && (
        <DetailSection
          label="Merged"
          count={mergedPRs.length}
          color="bg-emerald-500"
        >
          {mergedPRs.map((pr) => (
            <PRRow
              key={`${pr.repositoryId}:${pr.number}`}
              repo={pr.repo}
              number={pr.number}
              title={pr.title}
              url={pr.url}
              complexity={pr.complexity}
              date={dayjs(pr.mergedAt).format('M/D HH:mm')}
              extra={
                pr.totalTime ? `${(pr.totalTime / 24).toFixed(1)}d` : undefined
              }
            />
          ))}
        </DetailSection>
      )}

      {reviews.length > 0 && (
        <DetailSection
          label="Reviewed"
          count={reviews.length}
          color="bg-purple-500"
        >
          {reviews.map((r) => (
            <PRRow
              key={`${r.repositoryId}:${r.number}:${r.submittedAt}`}
              repo={r.repo}
              number={r.number}
              title={r.title}
              url={r.url}
              complexity={r.complexity}
              author={r.author}
              date={dayjs(r.submittedAt).format('M/D HH:mm')}
              reviewState={r.state}
            />
          ))}
        </DetailSection>
      )}
    </Stack>
  )
}

function BlockRow({
  label,
  count,
  children,
}: {
  label: string
  count: number
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="w-28 shrink-0 truncate text-sm">{label}</span>
      <span className="text-muted-foreground w-8 shrink-0 text-right font-mono text-sm">
        {count}
      </span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-0.5">
        {children}
      </div>
    </div>
  )
}

function CalendarItem({
  color,
  label,
  title,
  suffix,
  complexity,
  prData,
  showAuthor,
  reviewState,
}: {
  color: string
  label: string
  title: string
  suffix?: string
  complexity?: string | null
  prData?: PRBlockData
  showAuthor?: boolean
  reviewState?: string
}) {
  const content = (
    <span className="group flex min-w-0 cursor-pointer items-start gap-1">
      <span
        className={`mt-1 inline-block size-2 shrink-0 rounded-full ${color}`}
      />
      <span className="min-w-0 text-[10px] leading-tight">
        <span className="text-muted-foreground group-hover:text-foreground">
          {label}
        </span>
        {complexity && (
          <span className="-mr-2 ml-0.5 inline-flex origin-left scale-[0.6]">
            <SizeBadge complexity={complexity} />
          </span>
        )}
        {suffix && (
          <span
            className={`ml-0.5 ${reviewState ? (REVIEW_STATE_STYLE[reviewState]?.className ?? '') : ''}`}
          >
            {suffix}
          </span>
        )}
        <br />
        <span className="text-muted-foreground/70 line-clamp-1">{title}</span>
      </span>
    </span>
  )

  if (!prData) return content

  return (
    <Popover>
      <PopoverTrigger asChild>{content}</PopoverTrigger>
      <PopoverContent side="top" className="w-72 p-3">
        <PRPopoverContent
          pr={prData}
          showAuthor={showAuthor}
          reviewState={reviewState}
        />
      </PopoverContent>
    </Popover>
  )
}

function DetailSection({
  label,
  count,
  color,
  children,
}: {
  label: string
  count: number
  color: string
  children: React.ReactNode
}) {
  return (
    <div>
      <h2 className="mb-2 flex items-center gap-1.5 text-sm font-medium">
        <span className={`inline-block size-2 rounded-full ${color}`} />
        {label} {count}
      </h2>
      <div className="divide-y">{children}</div>
    </div>
  )
}

function PRRow({
  repo,
  number,
  title,
  url,
  complexity,
  date,
  extra,
  author,
  reviewState,
}: {
  repo: string
  number: number
  title: string
  url: string
  complexity: string | null
  date: string
  extra?: string
  author?: string
  reviewState?: string
}) {
  const stateStyle = reviewState ? REVIEW_STATE_STYLE[reviewState] : null
  return (
    <div className="flex items-center gap-2 py-1 text-sm">
      <a
        href={url}
        className="shrink-0 text-blue-500 hover:underline"
        target="_blank"
        rel="noreferrer noopener"
      >
        {repo}#{number}
      </a>
      <SizeBadge complexity={complexity} />
      {stateStyle && (
        <span
          className={`shrink-0 text-xs font-medium ${stateStyle.className}`}
        >
          {stateStyle.icon} {stateStyle.text}
        </span>
      )}
      <span className="truncate">{title}</span>
      <span className="text-muted-foreground ml-auto flex shrink-0 items-center gap-1 text-xs">
        {author && (
          <>
            <Avatar className="size-4">
              <AvatarImage
                src={`https://github.com/${author}.png`}
                alt={author}
              />
              <AvatarFallback className="text-[6px]">
                {author.slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <span>{author}</span>
            <span>·</span>
          </>
        )}
        {date}
        {extra && ` · ${extra}`}
      </span>
    </div>
  )
}
