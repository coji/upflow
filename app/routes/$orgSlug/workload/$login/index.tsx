import holiday_jp from '@holiday-jp/holiday_jp'
import { useMemo } from 'react'
import { Link, href, useSearchParams } from 'react-router'
import { SizeBadge } from '~/app/components/size-badge'
import { Avatar, AvatarFallback, AvatarImage } from '~/app/components/ui/avatar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/app/components/ui/popover'
import { HStack, Stack } from '~/app/components/ui/stack'
import { ToggleGroup, ToggleGroupItem } from '~/app/components/ui/toggle-group'
import WeeklyCalendar from '~/app/components/week-calendar'
import { useTimezone } from '~/app/hooks/use-timezone'
import { getEndOfWeek, getStartOfWeek } from '~/app/libs/date-utils'
import dayjs from '~/app/libs/dayjs'
import { PR_SIZE_RANK } from '~/app/libs/pr-classify'
import { orgContext, timezoneContext } from '~/app/middleware/context'
import {
  PRBlock,
  PRPopoverContent,
  REVIEW_STATE_STYLE,
  REVIEW_STATUS_PRIORITY,
  type PRBlockData,
  type PRReviewStatus,
} from '~/app/routes/$orgSlug/+components/pr-block'
import {
  buildPRReviewerStatesMap,
  classifyPRReviewStatus,
} from '~/app/routes/$orgSlug/workload/+functions/aggregate-stacks'
import {
  getBacklogDetails,
  getClosedPRs,
  getCreatedPRs,
  getMergedPRs,
  getReviewsSubmitted,
  getUserProfile,
} from './+functions/queries.server'
import type { Route } from './+types/index'

export const handle = {
  breadcrumb: (data: Awaited<ReturnType<typeof loader>>) => ({
    label: data.user.displayName ?? data.user.login,
  }),
}

export const loader = async ({
  request,
  params,
  context,
}: Route.LoaderArgs) => {
  const { organization } = context.get(orgContext)
  const timezone = context.get(timezoneContext)

  const url = new URL(request.url)
  const weekParam = url.searchParams.get('week')

  const parsed = weekParam ? dayjs(weekParam, 'YYYY-MM-DD') : null
  const weekStart = parsed?.isValid()
    ? getStartOfWeek(parsed.toDate(), timezone)
    : getStartOfWeek(undefined, timezone)
  const weekEnd = getEndOfWeek(weekStart.toDate(), timezone)
  const from = weekStart.utc().toISOString()
  const to = weekEnd.utc().toISOString()

  const [user, createdPRs, mergedPRs, closedPRs, reviews, backlog] =
    await Promise.all([
      getUserProfile(organization.id, params.login),
      getCreatedPRs(organization.id, params.login, from, to),
      getMergedPRs(organization.id, params.login, from, to),
      getClosedPRs(organization.id, params.login, from, to),
      getReviewsSubmitted(organization.id, params.login, from, to),
      getBacklogDetails(organization.id, params.login),
    ])

  // Build holiday map for the week
  const holidays: Record<string, string> = {}
  for (const h of holiday_jp.between(weekStart.toDate(), weekEnd.toDate())) {
    holidays[dayjs(h.date).tz(timezone).format('YYYY-MM-DD')] = h.name
  }

  // Enrich backlog PRs with reviewStatus + reviewerStates
  const reviewerStatesByPR = buildPRReviewerStatesMap(
    backlog.reviewHistory,
    backlog.reviewerRows,
  )
  const pendingReviewerPRKeys = new Set<string>()
  for (const r of backlog.reviewerRows) {
    pendingReviewerPRKeys.add(`${r.repositoryId}:${r.number}`)
  }
  const enrichedOpenPRs = backlog.openPRs.map((pr) => {
    const prKey = `${pr.repositoryId}:${pr.number}`
    const reviewerStates = reviewerStatesByPR.get(prKey)
    const reviewStatus = classifyPRReviewStatus(
      pendingReviewerPRKeys.has(prKey),
      reviewerStates,
      params.login,
    )
    return { ...pr, reviewStatus, reviewerStates }
  })
  const enrichedPendingReviews = backlog.pendingReviews.map((pr) => {
    const prKey = `${pr.repositoryId}:${pr.number}`
    const reviewerStates = reviewerStatesByPR.get(prKey)
    return { ...pr, reviewStatus: 'in-review' as const, reviewerStates }
  })

  return {
    user,
    createdPRs,
    mergedPRs,
    closedPRs,
    reviews,
    backlog: {
      openPRs: enrichedOpenPRs,
      pendingReviews: enrichedPendingReviews,
    },
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
    closedPRs,
    reviews,
    backlog,
    holidays,
    weekStart,
  },
  params,
}: Route.ComponentProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const timezone = useTimezone()

  const viewParam = searchParams.get('view')
  const colorMode = viewParam === 'size' ? 'size' : 'age'
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
  const backParams = new URLSearchParams(searchParams)
  backParams.delete('week')
  const backQuery = backParams.size > 0 ? `?${backParams.toString()}` : ''

  const handleWeekChange = (start: Date) => {
    setSearchParams((prev) => {
      prev.set('week', dayjs(start).tz(timezone).format('YYYY-MM-DD'))
      return prev
    })
  }

  const sortBacklog = useMemo(() => {
    return <
      T extends {
        complexity: string | null
        pullRequestCreatedAt: string
        reviewStatus?: PRReviewStatus
      },
    >(
      prs: T[],
    ): T[] => {
      return [...prs].sort((a, b) => {
        const pa = REVIEW_STATUS_PRIORITY[a.reviewStatus ?? 'in-review'] ?? 3
        const pb = REVIEW_STATUS_PRIORITY[b.reviewStatus ?? 'in-review'] ?? 3
        if (pa !== pb) return pa - pb
        if (colorMode === 'size') {
          const ai = PR_SIZE_RANK[a.complexity ?? ''] ?? -1
          const bi = PR_SIZE_RANK[b.complexity ?? ''] ?? -1
          return bi - ai
        }
        return a.pullRequestCreatedAt.localeCompare(b.pullRequestCreatedAt)
      })
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

  const groupedReviews = useMemo(() => {
    const groups = new Map<
      string,
      (typeof reviews)[number] & {
        reviewCount: number
        dayKey: string
        firstSubmittedAt: string
        lastSubmittedAt: string
      }
    >()

    for (const review of reviews) {
      const dayKey = dayjs
        .utc(review.submittedAt)
        .tz(timezone)
        .format('YYYY-MM-DD')
      const key = `${review.repositoryId}:${review.number}:${review.state}:${dayKey}`
      const existing = groups.get(key)

      if (!existing) {
        groups.set(key, {
          ...review,
          reviewCount: 1,
          dayKey,
          firstSubmittedAt: review.submittedAt,
          lastSubmittedAt: review.submittedAt,
        })
        continue
      }

      const next =
        review.submittedAt >= existing.submittedAt
          ? { ...review, dayKey }
          : { ...existing }
      groups.set(key, {
        ...next,
        reviewCount: existing.reviewCount + 1,
        dayKey,
        firstSubmittedAt:
          review.submittedAt < existing.firstSubmittedAt
            ? review.submittedAt
            : existing.firstSubmittedAt,
        lastSubmittedAt:
          review.submittedAt > existing.lastSubmittedAt
            ? review.submittedAt
            : existing.lastSubmittedAt,
      })
    }

    return [...groups.values()].sort((a, b) =>
      a.submittedAt.localeCompare(b.submittedAt),
    )
  }, [reviews, timezone])

  const reviewedPRCount = useMemo(() => {
    return new Set(
      reviews.map((review) => `${review.repositoryId}:${review.number}`),
    ).size
  }, [reviews])

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
        (pr) =>
          dayjs
            .utc(pr.pullRequestCreatedAt)
            .tz(timezone)
            .format('YYYY-MM-DD') === dateStr,
      ),
      merged: mergedPRs.filter(
        (pr) =>
          dayjs.utc(pr.mergedAt).tz(timezone).format('YYYY-MM-DD') === dateStr,
      ),
      closed: closedPRs.filter(
        (pr) =>
          dayjs.utc(pr.closedAt).tz(timezone).format('YYYY-MM-DD') === dateStr,
      ),
      reviewed: groupedReviews.filter((r) => r.dayKey === dateStr),
    }
  })

  return (
    <Stack>
      {/* Header */}
      <div className="flex items-center justify-between">
        <HStack>
          <Link
            to={`${href('/:orgSlug/workload', { orgSlug: params.orgSlug })}${backQuery}`}
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
                  reviewStatus: pr.reviewStatus,
                  reviewerStates: pr.reviewerStates,
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
                  authorDisplayName: pr.authorDisplayName ?? undefined,
                  createdAt: pr.pullRequestCreatedAt,
                  complexity: pr.complexity,
                  reviewStatus: pr.reviewStatus,
                  reviewerStates: pr.reviewerStates,
                }}
              />
            ))}
          </BlockRow>
        </div>
      </div>

      <hr className="border-border" />

      {/* Weekly activity header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <h2 className="text-muted-foreground text-sm font-medium">
            This Week
          </h2>
          <div className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-xs">
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
              Reviewed (unique) {reviewedPRCount}
            </span>
            <span>
              <span className="inline-block size-2 rounded-full bg-gray-500" />{' '}
              Closed {closedPRs.length}
            </span>
          </div>
        </div>

        <div className="self-start sm:self-auto">
          <WeeklyCalendar value={weekStart} onWeekChange={handleWeekChange} />
        </div>
      </div>

      {/* Daily calendar */}
      <div className="-mx-1 overflow-x-auto px-1">
        <div className="grid min-w-[42rem] grid-cols-7 gap-1">
          {days.map((day) => {
            const isOff =
              day.date.day() === 0 ||
              day.date.day() === 6 ||
              day.holiday !== null
            const total =
              day.created.length +
              day.merged.length +
              day.closed.length +
              day.reviewed.length
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
                        key={`r-${r.repositoryId}:${r.number}:${r.state}:${r.dayKey}`}
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
                          createdAt: r.pullRequestCreatedAt,
                          complexity: r.complexity,
                        }}
                        reviewState={r.state}
                        reviewCount={r.reviewCount}
                        suffix={REVIEW_STATE_STYLE[r.state]?.icon}
                      />
                    ))}
                    {day.closed.map((pr) => (
                      <CalendarItem
                        key={`x-${pr.repositoryId}:${pr.number}`}
                        color="bg-gray-500"
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
                  </div>
                )}
              </div>
            )
          })}
        </div>
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
              date={dayjs
                .utc(pr.pullRequestCreatedAt)
                .tz(timezone)
                .format('M/D HH:mm')}
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
              date={dayjs.utc(pr.mergedAt).tz(timezone).format('M/D HH:mm')}
              extra={pr.totalTime ? `${pr.totalTime.toFixed(1)}d` : undefined}
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
          {groupedReviews.map((r) => (
            <PRRow
              key={`${r.repositoryId}:${r.number}:${r.state}:${r.dayKey}`}
              repo={r.repo}
              number={r.number}
              title={r.title}
              url={r.url}
              complexity={r.complexity}
              author={r.author}
              date={
                r.reviewCount > 1
                  ? `${dayjs.utc(r.firstSubmittedAt).tz(timezone).format('M/D HH:mm')}-${dayjs.utc(r.lastSubmittedAt).tz(timezone).format('HH:mm')}`
                  : dayjs.utc(r.submittedAt).tz(timezone).format('M/D HH:mm')
              }
              extra={undefined}
              reviewCount={r.reviewCount}
              reviewState={r.state}
            />
          ))}
        </DetailSection>
      )}

      {closedPRs.length > 0 && (
        <DetailSection
          label="Closed"
          count={closedPRs.length}
          color="bg-gray-500"
        >
          {closedPRs.map((pr) => (
            <PRRow
              key={`${pr.repositoryId}:${pr.number}`}
              repo={pr.repo}
              number={pr.number}
              title={pr.title}
              url={pr.url}
              complexity={pr.complexity}
              date={dayjs.utc(pr.closedAt).tz(timezone).format('M/D HH:mm')}
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
  reviewState,
  reviewCount,
}: {
  color: string
  label: string
  title: string
  suffix?: string
  complexity?: string | null
  prData?: PRBlockData
  reviewState?: string
  reviewCount?: number
}) {
  const suffixText = [
    suffix,
    reviewCount && reviewCount > 1 ? `×${reviewCount}` : null,
  ]
    .filter(Boolean)
    .join(' ')
  const content = (
    <button
      type="button"
      className="group flex min-w-0 items-start gap-1 text-left"
    >
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
        {suffixText && (
          <span
            className={`ml-0.5 ${reviewState ? (REVIEW_STATE_STYLE[reviewState]?.className ?? '') : ''}`}
          >
            {suffixText}
          </span>
        )}
        <br />
        <span className="text-muted-foreground/70 line-clamp-1">{title}</span>
      </span>
    </button>
  )

  if (!prData) return content

  return (
    <Popover>
      <PopoverTrigger asChild>{content}</PopoverTrigger>
      <PopoverContent side="top" className="w-72 p-3">
        <PRPopoverContent pr={prData} reviewState={reviewState} />
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
  reviewCount,
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
  reviewCount?: number
}) {
  const stateStyle = reviewState ? REVIEW_STATE_STYLE[reviewState] : null
  return (
    <div className="flex flex-col gap-1 py-1 text-sm lg:grid lg:grid-cols-[max-content_max-content_minmax(0,1fr)_auto] lg:items-center lg:gap-x-4 lg:gap-y-0">
      <div className="flex min-w-0 items-start justify-between gap-2 lg:contents">
        <a
          href={url}
          className="min-w-0 truncate text-blue-500 hover:underline lg:block"
          target="_blank"
          rel="noreferrer noopener"
        >
          {repo}#{number}
        </a>
        <div className="flex shrink-0 items-center gap-2 lg:min-w-0">
          <SizeBadge complexity={complexity} />
          {stateStyle && (
            <span
              className={`shrink-0 text-xs font-medium ${stateStyle.className}`}
            >
              {stateStyle.icon} {stateStyle.text}
              {reviewCount && reviewCount > 1 ? ` ×${reviewCount}` : ''}
            </span>
          )}
        </div>
      </div>
      <span className="line-clamp-2 break-words lg:line-clamp-1 lg:min-w-0">
        {title}
      </span>
      <span className="text-muted-foreground flex flex-wrap items-center gap-1 text-xs lg:justify-self-end lg:text-right">
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
        {extra && (
          <>
            <span>{extra}</span>
            <span>·</span>
          </>
        )}
        <span>{date}</span>
      </span>
    </div>
  )
}
