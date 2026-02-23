import { Octokit } from 'octokit'

export function createGitHubClient(token: string) {
  const octokit = new Octokit({ auth: token })

  async function fetchReviewEvents(
    owner: string,
    repo: string,
    opts: { maxPages?: number } = {},
  ) {
    const maxPages = opts.maxPages ?? 8
    const allPRs: ReviewEventPR[] = []
    let cursor: string | null = null

    for (let page = 0; page < maxPages; page++) {
      const afterClause = cursor ? `, after: "${cursor}"` : ''
      const query = `{
        repository(owner: "${owner}", name: "${repo}") {
          pullRequests(first: 50, orderBy: {field: CREATED_AT, direction: DESC}, states: [MERGED]${afterClause}) {
            pageInfo { hasNextPage endCursor }
            nodes {
              number
              title
              author { login }
              createdAt
              mergedAt
              timelineItems(first: 100, itemTypes: [REVIEW_REQUESTED_EVENT, PULL_REQUEST_REVIEW, REVIEW_REQUEST_REMOVED_EVENT, READY_FOR_REVIEW_EVENT, CONVERT_TO_DRAFT_EVENT]) {
                nodes {
                  __typename
                  ... on ReviewRequestedEvent {
                    createdAt
                    requestedReviewer {
                      ... on User { login }
                      ... on Team { name }
                    }
                  }
                  ... on PullRequestReview {
                    createdAt
                    author { login }
                    state
                  }
                  ... on ReviewRequestRemovedEvent {
                    createdAt
                    requestedReviewer {
                      ... on User { login }
                      ... on Team { name }
                    }
                  }
                  ... on ReadyForReviewEvent { createdAt }
                  ... on ConvertToDraftEvent { createdAt }
                }
              }
            }
          }
        }
      }`

      const response: any = await octokit.graphql(query)
      const repository = response.repository
      if (!repository?.pullRequests) break

      const prs = repository.pullRequests
      for (const node of prs.nodes) {
        allPRs.push({ ...node, repo })
      }

      if (!prs.pageInfo.hasNextPage) break
      cursor = prs.pageInfo.endCursor
    }

    return allPRs
  }

  async function fetchPRSizes(
    owner: string,
    repo: string,
    opts: { maxPages?: number } = {},
  ) {
    const maxPages = opts.maxPages ?? 8
    const allPRs: PRSizeInfo[] = []
    let cursor: string | null = null

    for (let page = 0; page < maxPages; page++) {
      const afterClause = cursor ? `, after: "${cursor}"` : ''
      const query = `{
        repository(owner: "${owner}", name: "${repo}") {
          pullRequests(first: 50, orderBy: {field: CREATED_AT, direction: DESC}, states: [MERGED]${afterClause}) {
            pageInfo { hasNextPage endCursor }
            nodes {
              number
              title
              author { login }
              createdAt
              mergedAt
              additions
              deletions
              changedFiles
              labels(first: 10) { nodes { name } }
              files(first: 100) {
                nodes { path additions deletions }
              }
            }
          }
        }
      }`

      const response: any = await octokit.graphql(query)
      const repository = response.repository
      if (!repository?.pullRequests) break

      const prs = repository.pullRequests
      for (const node of prs.nodes) {
        allPRs.push({ ...node, owner, repo })
      }

      if (!prs.pageInfo.hasNextPage) break
      cursor = prs.pageInfo.endCursor
    }

    return allPRs
  }

  return { fetchReviewEvents, fetchPRSizes }
}

// Types

export interface ReviewEventPR {
  number: number
  title: string
  author: { login: string } | null
  createdAt: string
  mergedAt: string | null
  repo: string
  timelineItems: {
    nodes: TimelineItem[]
  }
}

export type TimelineItem =
  | {
      __typename: 'ReviewRequestedEvent'
      createdAt: string
      requestedReviewer: { login?: string; name?: string }
    }
  | {
      __typename: 'PullRequestReview'
      createdAt: string
      author: { login: string } | null
      state: string
    }
  | {
      __typename: 'ReviewRequestRemovedEvent'
      createdAt: string
      requestedReviewer: { login?: string; name?: string }
    }
  | { __typename: 'ReadyForReviewEvent'; createdAt: string }
  | { __typename: 'ConvertToDraftEvent'; createdAt: string }

export interface PRSizeInfo {
  number: number
  title: string
  author: { login: string } | null
  createdAt: string
  mergedAt: string | null
  additions: number
  deletions: number
  changedFiles: number
  owner: string
  repo: string
  labels: { nodes: { name: string }[] }
  files: { nodes: { path: string; additions: number; deletions: number }[] }
}
