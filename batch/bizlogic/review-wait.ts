import type {
  ReviewerType,
  ShapedGitHubPullRequest,
  ShapedGitHubReview,
  ShapedGitHubReviewComment,
  ShapedTimelineItem,
} from '~/batch/github/model'

// --- Types ---

interface NormalizedTimelineEvent {
  type: string
  createdAt: string
  subjectLogin: string
}

export interface ReviewWaitResult {
  pickupStartedAt: string | null
  pickupTimeDays: number | null
}

// --- Eligibility ---

export function isEligibleReviewer(props: {
  login: string | null
  actorType: ReviewerType | null
  authorLogin: string | null
  botLogins: Set<string>
}): boolean {
  const login = props.login?.toLowerCase()
  if (!login) return false
  // null は旧 raw データ（reviewerType 未保存）との後方互換。botLogins で補完する
  if (props.actorType && props.actorType !== 'User') return false
  if (props.authorLogin && login === props.authorLogin.toLowerCase())
    return false
  if (props.botLogins.has(login)) return false
  return true
}

// --- Timeline normalization ---

const TIMELINE_ORDER: Record<string, number> = {
  ConvertToDraftEvent: 0,
  ReviewRequestRemovedEvent: 1,
  ReadyForReviewEvent: 2,
  ReviewRequestedEvent: 3,
}

export function normalizeTimelineEvents(
  timelineItems: ShapedTimelineItem[],
  pr: ShapedGitHubPullRequest,
  botLogins: Set<string>,
): NormalizedTimelineEvent[] {
  const normalized: NormalizedTimelineEvent[] = []

  for (const item of timelineItems) {
    if (
      item.type === 'ReviewRequestedEvent' ||
      item.type === 'ReviewRequestRemovedEvent'
    ) {
      if (
        !isEligibleReviewer({
          login: item.reviewer ?? null,
          actorType: item.reviewerType ?? null,
          authorLogin: pr.author,
          botLogins,
        })
      ) {
        continue
      }
      normalized.push({
        type: item.type,
        createdAt: item.createdAt,
        subjectLogin: (item.reviewer ?? '').toLowerCase(),
      })
    } else if (
      item.type === 'ReadyForReviewEvent' ||
      item.type === 'ConvertToDraftEvent'
    ) {
      normalized.push({
        type: item.type,
        createdAt: item.createdAt,
        subjectLogin: '',
      })
    }
  }

  return normalized.sort(
    (a, b) =>
      a.createdAt.localeCompare(b.createdAt) ||
      (TIMELINE_ORDER[a.type] ?? 9) - (TIMELINE_ORDER[b.type] ?? 9) ||
      a.subjectLogin.localeCompare(b.subjectLogin),
  )
}

// --- Initial state ---

export function inferInitialState(
  pr: ShapedGitHubPullRequest,
  normalizedTimeline: NormalizedTimelineEvent[],
): 'draft' | 'ready' {
  const firstDraftEvent = normalizedTimeline.find(
    (event) =>
      event.type === 'ReadyForReviewEvent' ||
      event.type === 'ConvertToDraftEvent',
  )

  if (firstDraftEvent?.type === 'ReadyForReviewEvent') return 'draft'
  if (firstDraftEvent?.type === 'ConvertToDraftEvent') return 'ready'
  return pr.draft ? 'draft' : 'ready'
}

// --- State machine ---

export function deriveReviewWait(
  pr: ShapedGitHubPullRequest,
  normalizedTimeline: NormalizedTimelineEvent[],
  firstReviewedAt: string | null,
): ReviewWaitResult {
  const cutoff = firstReviewedAt ?? pr.mergedAt ?? null

  const pending = new Set<string>()
  let state = inferInitialState(pr, normalizedTimeline)
  let activeSince: string | null = null
  let pickupStartedAt: string | null = null
  let pickupMs = 0

  for (const event of normalizedTimeline) {
    if (cutoff && event.createdAt > cutoff) break

    if (event.type === 'ReviewRequestedEvent') pending.add(event.subjectLogin)
    if (event.type === 'ReviewRequestRemovedEvent')
      pending.delete(event.subjectLogin)
    if (event.type === 'ReadyForReviewEvent') state = 'ready'
    if (event.type === 'ConvertToDraftEvent') state = 'draft'

    const shouldBeActive = state === 'ready' && pending.size > 0
    if (!activeSince && shouldBeActive) {
      activeSince = event.createdAt
      pickupStartedAt ??= event.createdAt
    }
    if (activeSince && !shouldBeActive) {
      pickupMs += Date.parse(event.createdAt) - Date.parse(activeSince)
      activeSince = null
    }
  }

  if (activeSince && cutoff) {
    pickupMs += Date.parse(cutoff) - Date.parse(activeSince)
  }

  if (!cutoff) return { pickupStartedAt, pickupTimeDays: null }
  if (!pickupStartedAt) return { pickupStartedAt: null, pickupTimeDays: null }
  return { pickupStartedAt, pickupTimeDays: pickupMs / 86_400_000 }
}

// --- firstReviewedAt ---

/**
 * filterActors 済みの discussions/reviews から最小時刻を取る。
 * PENDING レビューは除外する。
 */
export function computeFirstReviewedAt(
  discussions: ShapedGitHubReviewComment[],
  reviews: ShapedGitHubReview[],
): string | null {
  let earliest: string | null = null

  for (const d of discussions) {
    if (d.createdAt && (!earliest || d.createdAt < earliest)) {
      earliest = d.createdAt
    }
  }

  for (const r of reviews) {
    if (!r.submittedAt || r.state === 'PENDING') continue
    if (!earliest || r.submittedAt < earliest) {
      earliest = r.submittedAt
    }
  }

  return earliest
}
