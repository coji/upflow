import holiday_jp from '@holiday-jp/holiday_jp'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import { Avatar, AvatarFallback, AvatarImage } from '~/app/components/ui/avatar'
import { Button } from '~/app/components/ui/button'
import { HStack, Stack } from '~/app/components/ui/stack'
import { requireOrgMember } from '~/app/libs/auth.server'
import { getEndOfWeek, getStartOfWeek } from '~/app/libs/date-utils'
import dayjs from '~/app/libs/dayjs'
import { SizeBadge } from '~/app/routes/$orgSlug/+components/size-badge'
import {
  getBacklogCounts,
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
    getBacklogCounts(organization.id, params.login),
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
  const [, setSearchParams] = useSearchParams()

  const prevWeek = dayjs(weekStart).subtract(7, 'day').format('YYYY-MM-DD')
  const nextWeek = dayjs(weekStart).add(7, 'day').format('YYYY-MM-DD')
  const isCurrentWeek = dayjs(weekStart).isSame(getStartOfWeek(), 'day')

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

  // Estimate weeks to clear backlog based on this week's merge rate
  const mergeRate = mergedPRs.length
  const weeksToClear =
    mergeRate > 0 ? Math.ceil(backlog.openPRs / mergeRate) : null

  return (
    <Stack>
      {/* Header */}
      <div className="flex items-center justify-between">
        <HStack>
          <Link
            to={`/${params.orgSlug}/stacks`}
            className="text-muted-foreground hover:text-foreground text-sm"
          >
            ← Review Stacks
          </Link>
        </HStack>
      </div>

      <div className="flex items-center justify-between">
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
            <p className="text-muted-foreground text-sm">{user.login}</p>
          </div>
        </HStack>

        {/* Week navigation */}
        <HStack>
          <Button
            variant="outline"
            size="icon"
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

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Created" value={createdPRs.length} />
        <StatCard label="Merged" value={mergedPRs.length} />
        <StatCard label="Reviewed" value={reviews.length} />
        <StatCard
          label="Open PRs"
          value={backlog.openPRs}
          sub={weeksToClear ? `~${weeksToClear}w to clear` : undefined}
        />
        <StatCard label="Review Queue" value={backlog.pendingReviews} />
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
                      url={pr.url}
                    />
                  ))}
                  {day.merged.map((pr) => (
                    <CalendarItem
                      key={`m-${pr.repositoryId}:${pr.number}`}
                      color="bg-emerald-500"
                      label={`#${pr.number}`}
                      title={pr.title}
                      url={pr.url}
                    />
                  ))}
                  {day.reviewed.map((r) => (
                    <CalendarItem
                      key={`r-${r.repositoryId}:${r.number}:${r.submittedAt}`}
                      color="bg-purple-500"
                      label={`#${r.number}`}
                      title={r.title}
                      url={r.url}
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

      {/* Legend */}
      <div className="text-muted-foreground flex gap-4 text-xs">
        <span className="flex items-center gap-1">
          <span className="inline-block size-2.5 rounded-full bg-blue-500" />
          Created
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block size-2.5 rounded-full bg-emerald-500" />
          Merged
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block size-2.5 rounded-full bg-purple-500" />
          Reviewed
        </span>
      </div>

      {/* Detail sections */}
      {createdPRs.length > 0 && (
        <DetailSection title={`Created (${createdPRs.length})`}>
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
        <DetailSection title={`Merged (${mergedPRs.length})`}>
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
        <DetailSection title={`Reviews (${reviews.length})`}>
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
              extra={
                r.state === 'APPROVED'
                  ? 'Approved'
                  : r.state === 'CHANGES_REQUESTED'
                    ? 'Changes'
                    : 'Comment'
              }
            />
          ))}
        </DetailSection>
      )}
    </Stack>
  )
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string
  value: number
  sub?: string
}) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
      {sub && <div className="text-muted-foreground text-xs">{sub}</div>}
    </div>
  )
}

function CalendarItem({
  color,
  label,
  title,
  url,
  suffix,
}: {
  color: string
  label: string
  title: string
  url: string
  suffix?: string
}) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      className="group flex min-w-0 items-start gap-1"
      title={`${label} ${title}`}
    >
      <span
        className={`mt-1 inline-block size-2 shrink-0 rounded-full ${color}`}
      />
      <span className="min-w-0 text-[10px] leading-tight">
        <span className="text-muted-foreground group-hover:text-foreground">
          {label}
        </span>
        {suffix && <span className="ml-0.5">{suffix}</span>}
        <br />
        <span className="text-muted-foreground/70 line-clamp-1">{title}</span>
      </span>
    </a>
  )
}

function DetailSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div>
      <h2 className="mb-2 text-sm font-medium">{title}</h2>
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
}: {
  repo: string
  number: number
  title: string
  url: string
  complexity: string | null
  date: string
  extra?: string
  author?: string
}) {
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
