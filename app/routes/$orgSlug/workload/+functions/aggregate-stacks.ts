import type {
  PRReviewStatus,
  PRReviewerState,
  PRReviewerStateEntry,
} from '~/app/routes/$orgSlug/+components/pr-block'

export type ReviewStatus = PRReviewStatus
export type ReviewerState = PRReviewerState
export type ReviewerStateEntry = PRReviewerStateEntry

export interface StackPR {
  number: number
  repo: string
  title: string
  url: string
  author: string
  createdAt: string
  complexity: string | null
  hasReviewer?: boolean
  reviewStatus?: ReviewStatus
  reviewerStates?: ReviewerStateEntry[]
}

export interface PersonStack {
  login: string
  displayName: string
  prs: StackPR[]
}

export interface TeamStacksData {
  authorStacks: PersonStack[]
  reviewerStacks: PersonStack[]
  unassignedPRs: StackPR[]
  approvedAwaitingMergePRs: StackPR[]
  changesPendingPRs: StackPR[]
  personalLimit: number
  insight: string | null
  autoMergeSuggestion: boolean
}

interface OpenPRRow {
  author: string
  authorDisplayName: string | null
  number: number
  repositoryId: string
  repo: string
  title: string
  url: string
  pullRequestCreatedAt: string
  complexity: string | null
}

interface PendingReviewRow {
  reviewer: string
  reviewerDisplayName: string | null
  number: number
  repositoryId: string
  repo: string
  title: string
  url: string
  author: string
  pullRequestCreatedAt: string
  complexity: string | null
}

interface ReviewRow {
  number: number
  repositoryId: string
  reviewer: string
  reviewerDisplayName: string | null
  state: string
  submittedAt: string
}

export const DEFAULT_PERSONAL_LIMIT = 2
/** approvedAwaitingMerge がこの件数を超えたら auto-merge 有効化サジェストを出す */
export const AUTO_MERGE_SUGGESTION_THRESHOLD = 3

const REVIEWER_STATE_SORT_ORDER: Record<ReviewerState, number> = {
  APPROVED: 0,
  CHANGES_REQUESTED: 1,
  COMMENTED: 2,
  REQUESTED: 3,
}

const SUBMITTED_REVIEW_STATES = new Set<ReviewerState>([
  'APPROVED',
  'CHANGES_REQUESTED',
  'COMMENTED',
])

function buildReviewerStatesMap(
  reviews: ReviewRow[],
  pendingReviews: PendingReviewRow[],
): Map<string, ReviewerStateEntry[]> {
  const byPR = new Map<string, Map<string, ReviewerStateEntry>>()
  const getBucket = (prKey: string) => {
    let bucket = byPR.get(prKey)
    if (!bucket) {
      bucket = new Map()
      byPR.set(prKey, bucket)
    }
    return bucket
  }

  for (const r of reviews) {
    const state = r.state as ReviewerState
    // GitHub の DISMISSED / PENDING は Popover 表示対象外
    if (!SUBMITTED_REVIEW_STATES.has(state)) continue
    const prKey = `${r.repositoryId}:${r.number}`
    const reviewerKey = r.reviewer.toLowerCase()
    const bucket = getBucket(prKey)
    const existing = bucket.get(reviewerKey)
    if (!existing || r.submittedAt > (existing.submittedAt ?? '')) {
      bucket.set(reviewerKey, {
        login: r.reviewer,
        displayName: r.reviewerDisplayName ?? r.reviewer,
        state,
        submittedAt: r.submittedAt,
      })
    }
  }

  for (const p of pendingReviews) {
    const prKey = `${p.repositoryId}:${p.number}`
    const reviewerKey = p.reviewer.toLowerCase()
    const bucket = getBucket(prKey)
    if (bucket.has(reviewerKey)) continue
    bucket.set(reviewerKey, {
      login: p.reviewer,
      displayName: p.reviewerDisplayName ?? p.reviewer,
      state: 'REQUESTED',
    })
  }

  const result = new Map<string, ReviewerStateEntry[]>()
  for (const [prKey, bucket] of byPR) {
    const entries = [...bucket.values()].sort((a, b) => {
      const d =
        REVIEWER_STATE_SORT_ORDER[a.state] - REVIEWER_STATE_SORT_ORDER[b.state]
      return d !== 0 ? d : a.login.localeCompare(b.login)
    })
    result.set(prKey, entries)
  }
  return result
}

function classifyReviewStatus(
  hasPendingReviewer: boolean,
  statesForPR: ReviewerStateEntry[] | undefined,
  author: string,
): ReviewStatus {
  if (hasPendingReviewer) return 'in-review'
  // author 自身のレビュー（COMMENTED 等）はレビューとしてカウントしない
  const authorKey = author.toLowerCase()
  const submitted =
    statesForPR?.filter(
      (s) => s.state !== 'REQUESTED' && s.login.toLowerCase() !== authorKey,
    ) ?? []
  if (submitted.some((s) => s.state === 'APPROVED'))
    return 'approved-awaiting-merge'
  // CHANGES_REQUESTED が明示的にある場合のみ changes-pending。
  // COMMENTED のみは実質未レビュー扱いで unassigned に統合。
  if (submitted.some((s) => s.state === 'CHANGES_REQUESTED'))
    return 'changes-pending'
  return 'unassigned'
}

export interface AggregateTeamStacksInput {
  openPRs: OpenPRRow[]
  pendingReviews: PendingReviewRow[]
  reviewHistory?: ReviewRow[]
  personalLimit?: number
}

export function aggregateTeamStacks({
  openPRs,
  pendingReviews,
  reviewHistory = [],
  personalLimit = DEFAULT_PERSONAL_LIMIT,
}: AggregateTeamStacksInput): TeamStacksData {
  const reviewerStatesByPR = buildReviewerStatesMap(
    reviewHistory,
    pendingReviews,
  )
  const pendingReviewerPRKeys = new Set<string>()
  for (const p of pendingReviews) {
    pendingReviewerPRKeys.add(`${p.repositoryId}:${p.number}`)
  }

  const authorMap = new Map<string, PersonStack>()
  const unassignedPRs: StackPR[] = []
  const approvedAwaitingMergePRs: StackPR[] = []
  const changesPendingPRs: StackPR[] = []

  for (const pr of openPRs) {
    const prKey = `${pr.repositoryId}:${pr.number}`
    const reviewerStates = reviewerStatesByPR.get(prKey)
    const hasPendingReviewer = pendingReviewerPRKeys.has(prKey)
    const reviewStatus = classifyReviewStatus(
      hasPendingReviewer,
      reviewerStates,
      pr.author,
    )
    const stackPR: StackPR = {
      number: pr.number,
      repo: pr.repo,
      title: pr.title,
      url: pr.url,
      author: pr.author,
      createdAt: pr.pullRequestCreatedAt,
      complexity: pr.complexity,
      hasReviewer: hasPendingReviewer,
      reviewStatus,
      reviewerStates,
    }

    let stack = authorMap.get(pr.author)
    if (!stack) {
      stack = {
        login: pr.author,
        displayName: pr.authorDisplayName ?? pr.author,
        prs: [],
      }
      authorMap.set(pr.author, stack)
    }
    stack.prs.push(stackPR)

    if (!hasPendingReviewer) {
      if (reviewStatus === 'approved-awaiting-merge') {
        approvedAwaitingMergePRs.push(stackPR)
      } else if (reviewStatus === 'changes-pending') {
        changesPendingPRs.push(stackPR)
      } else {
        unassignedPRs.push(stackPR)
      }
    }
  }
  const authorStacks = [...authorMap.values()].sort(
    (a, b) => b.prs.length - a.prs.length,
  )

  const reviewerMap = new Map<string, PersonStack>()
  const seenPRs = new Map<string, Set<string>>()
  for (const row of pendingReviews) {
    const prKey = `${row.repositoryId}:${row.number}`
    let seen = seenPRs.get(row.reviewer)
    if (!seen) {
      seen = new Set()
      seenPRs.set(row.reviewer, seen)
    }
    if (seen.has(prKey)) continue
    seen.add(prKey)

    let stack = reviewerMap.get(row.reviewer)
    if (!stack) {
      stack = {
        login: row.reviewer,
        displayName: row.reviewerDisplayName ?? row.reviewer,
        prs: [],
      }
      reviewerMap.set(row.reviewer, stack)
    }
    stack.prs.push({
      number: row.number,
      repo: row.repo,
      title: row.title,
      url: row.url,
      author: row.author,
      createdAt: row.pullRequestCreatedAt,
      complexity: row.complexity,
      hasReviewer: true,
      reviewStatus: 'in-review',
      reviewerStates: reviewerStatesByPR.get(prKey),
    })
  }
  const reviewerStacks = [...reviewerMap.values()].sort(
    (a, b) => b.prs.length - a.prs.length,
  )

  const overLimitAuthors = authorStacks.filter(
    (s) => s.prs.length > personalLimit,
  ).length
  const overLimitReviewers = reviewerStacks.filter(
    (s) => s.prs.length > personalLimit,
  ).length

  const autoMergeSuggestion =
    approvedAwaitingMergePRs.length >= AUTO_MERGE_SUGGESTION_THRESHOLD

  const parts: string[] = []
  if (overLimitAuthors > 0) {
    parts.push(`${overLimitAuthors}人が目安（${personalLimit}件）を超過中`)
  }
  if (overLimitReviewers > 0) {
    const maxReviewer = reviewerStacks[0]
    parts.push(
      `${maxReviewer.displayName}に${maxReviewer.prs.length}件のレビューが集中`,
    )
  }
  if (unassignedPRs.length > 0) {
    parts.push(`${unassignedPRs.length}件のPRがレビュアー未アサイン`)
  }
  if (approvedAwaitingMergePRs.length > 0) {
    parts.push(`${approvedAwaitingMergePRs.length}件がApprove済みマージ待ち`)
  }
  if (changesPendingPRs.length > 0) {
    parts.push(`${changesPendingPRs.length}件が作者対応待ち`)
  }
  if (autoMergeSuggestion) {
    parts.push('auto-merge-on-approved の有効化を検討してください')
  }

  const insight = parts.length > 0 ? `${parts.join('。')}。` : null

  return {
    authorStacks,
    reviewerStacks,
    unassignedPRs,
    approvedAwaitingMergePRs,
    changesPendingPRs,
    personalLimit,
    insight,
    autoMergeSuggestion,
  }
}
