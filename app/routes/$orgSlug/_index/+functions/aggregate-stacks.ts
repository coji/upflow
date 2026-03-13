export interface StackPR {
  number: number
  repo: string
  title: string
  url: string
  author: string
  createdAt: string
  complexity: string | null
  hasReviewer?: boolean
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
  wipLimit: number
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

const WIP_LIMIT = 2

export function aggregateTeamStacks(
  openPRs: OpenPRRow[],
  reviewData: PendingReviewRow[],
): TeamStacksData {
  // PRs that have at least one reviewer assigned
  const assignedPRKeys = new Set<string>()
  for (const row of reviewData) {
    assignedPRKeys.add(`${row.repositoryId}:${row.number}`)
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
    stack.prs.push({
      number: pr.number,
      repo: pr.repo,
      title: pr.title,
      url: pr.url,
      author: pr.author,
      createdAt: pr.pullRequestCreatedAt,
      complexity: pr.complexity,
      hasReviewer: assignedPRKeys.has(`${pr.repositoryId}:${pr.number}`),
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
    .filter((pr) => !assignedPRKeys.has(`${pr.repositoryId}:${pr.number}`))
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
    (s) => s.prs.length > WIP_LIMIT,
  ).length
  const overLimitReviewers = reviewerStacks.filter(
    (s) => s.prs.length > WIP_LIMIT,
  ).length

  let insight: string | null = null
  if (overLimitAuthors > 0 || overLimitReviewers > 0) {
    const parts: string[] = []
    if (overLimitAuthors > 0) {
      parts.push(`${overLimitAuthors}人がWIP制限（${WIP_LIMIT}件）を超過中`)
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
    wipLimit: WIP_LIMIT,
    insight,
  }
}
