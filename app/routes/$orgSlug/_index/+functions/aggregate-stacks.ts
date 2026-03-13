export interface StackPR {
  number: number
  repo: string
  title: string
  url: string
  author: string
  createdAt: string
  complexity: string | null
  hasReviewer?: boolean
  reviewers?: string[]
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
  personalLimit: number
  insight: string | null
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

const DEFAULT_PERSONAL_LIMIT = 2

export function aggregateTeamStacks(
  openPRs: OpenPRRow[],
  reviewData: PendingReviewRow[],
  personalLimit = DEFAULT_PERSONAL_LIMIT,
): TeamStacksData {
  // Build PR key → reviewer logins map
  const prReviewerSets = new Map<string, Set<string>>()
  for (const row of reviewData) {
    const key = `${row.repositoryId}:${row.number}`
    let reviewers = prReviewerSets.get(key)
    if (!reviewers) {
      reviewers = new Set()
      prReviewerSets.set(key, reviewers)
    }
    reviewers.add(row.reviewer)
  }
  const prReviewersMap = new Map<string, string[]>()
  for (const [key, set] of prReviewerSets) {
    prReviewersMap.set(key, [...set])
  }

  // Author stacks: open PRs grouped by author
  const authorMap = new Map<string, PersonStack>()
  for (const pr of openPRs) {
    let stack = authorMap.get(pr.author)
    if (!stack) {
      stack = {
        login: pr.author,
        displayName: pr.authorDisplayName ?? pr.author,
        prs: [],
      }
      authorMap.set(pr.author, stack)
    }
    const prKey = `${pr.repositoryId}:${pr.number}`
    const reviewers = prReviewersMap.get(prKey)
    stack.prs.push({
      number: pr.number,
      repo: pr.repo,
      title: pr.title,
      url: pr.url,
      author: pr.author,
      createdAt: pr.pullRequestCreatedAt,
      complexity: pr.complexity,
      hasReviewer: reviewers != null,
      reviewers,
    })
  }
  const authorStacks = [...authorMap.values()].sort(
    (a, b) => b.prs.length - a.prs.length,
  )

  // Reviewer stacks: pending review assignments grouped by reviewer
  const reviewerMap = new Map<string, PersonStack>()
  const seenPRs = new Map<string, Set<string>>()
  for (const row of reviewData) {
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
    })
  }
  const reviewerStacks = [...reviewerMap.values()].sort(
    (a, b) => b.prs.length - a.prs.length,
  )

  // Unassigned PRs: open PRs with no pending reviewer
  const unassignedPRs: StackPR[] = openPRs
    .filter((pr) => !prReviewersMap.has(`${pr.repositoryId}:${pr.number}`))
    .map((pr) => ({
      number: pr.number,
      repo: pr.repo,
      title: pr.title,
      url: pr.url,
      author: pr.author,
      createdAt: pr.pullRequestCreatedAt,
      complexity: pr.complexity,
    }))

  const overLimitAuthors = authorStacks.filter(
    (s) => s.prs.length > personalLimit,
  ).length
  const overLimitReviewers = reviewerStacks.filter(
    (s) => s.prs.length > personalLimit,
  ).length

  let insight: string | null = null
  if (overLimitAuthors > 0 || overLimitReviewers > 0) {
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
    insight = `${parts.join('。')}。`
  } else if (unassignedPRs.length > 0) {
    insight = `${unassignedPRs.length}件のPRがレビュアー未アサイン。`
  }

  return {
    authorStacks,
    reviewerStacks,
    unassignedPRs,
    personalLimit: personalLimit,
    insight,
  }
}
