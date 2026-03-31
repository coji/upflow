import { print } from 'graphql'
import type { Octokit } from 'octokit'
import dayjs from '~/app/libs/dayjs'
import { logger } from '~/batch/helper/logger'
import { graphql, type ResultOf } from './graphql'
import type {
  ShapedGitHubCommit,
  ShapedGitHubIssueComment,
  ShapedGitHubPullRequest,
  ShapedGitHubPullRequestWithDetails,
  ShapedGitHubReview,
  ShapedGitHubReviewComment,
  ShapedGitHubTag,
  ShapedTimelineItem,
} from './model'

const GetPullRequestsQuery = graphql(`
  query GetPullRequests(
    $owner: String!
    $repo: String!
    $cursor: String
    $first: Int = 100
  ) {
    repository(owner: $owner, name: $repo) {
      pullRequests(
        first: $first
        after: $cursor
        orderBy: { field: CREATED_AT, direction: DESC }
      ) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          databaseId
          number
          state
          title
          body
          url
          isDraft
          createdAt
          updatedAt
          mergedAt
          closedAt
          additions
          deletions
          changedFiles
          headRefName
          baseRefName
          mergeCommit {
            oid
          }
          author {
            __typename
            login
          }
          assignees(first: 100) {
            nodes {
              login
            }
          }
          reviewRequests(first: 100) {
            nodes {
              requestedReviewer {
                __typename
                ... on User {
                  login
                }
                ... on Bot {
                  login
                }
                ... on Mannequin {
                  login
                }
              }
            }
          }
        }
      }
    }
  }
`)

const GetPullRequestListQuery = graphql(`
  query GetPullRequestList(
    $owner: String!
    $repo: String!
    $cursor: String
    $first: Int = 100
  ) {
    repository(owner: $owner, name: $repo) {
      pullRequests(
        first: $first
        after: $cursor
        orderBy: { field: UPDATED_AT, direction: DESC }
      ) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          number
          updatedAt
        }
      }
    }
  }
`)

const GetPullRequestQuery = graphql(`
  query GetPullRequest($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        databaseId
        number
        state
        title
        body
        url
        isDraft
        createdAt
        updatedAt
        mergedAt
        closedAt
        additions
        deletions
        changedFiles
        headRefName
        baseRefName
        mergeCommit {
          oid
        }
        author {
          __typename
          login
        }
        assignees(first: 100) {
          nodes {
            login
          }
        }
        reviewRequests(first: 100) {
          nodes {
            requestedReviewer {
              __typename
              ... on User {
                login
              }
              ... on Bot {
                login
              }
              ... on Mannequin {
                login
              }
            }
          }
        }
      }
    }
  }
`)

const GetPullRequestTimelineQuery = graphql(`
  query GetPullRequestTimeline($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        timelineItems(
          first: 100
          itemTypes: [
            REVIEW_REQUESTED_EVENT
            REVIEW_REQUEST_REMOVED_EVENT
            READY_FOR_REVIEW_EVENT
            CONVERT_TO_DRAFT_EVENT
            REVIEW_DISMISSED_EVENT
            DEPLOYED_EVENT
            CLOSED_EVENT
            REOPENED_EVENT
            MERGED_EVENT
            HEAD_REF_FORCE_PUSHED_EVENT
          ]
        ) {
          nodes {
            __typename
            ... on ReviewRequestedEvent {
              createdAt
              requestedReviewer {
                __typename
                ... on User {
                  login
                }
                ... on Bot {
                  login
                }
                ... on Mannequin {
                  login
                }
              }
            }
            ... on ReviewRequestRemovedEvent {
              createdAt
              requestedReviewer {
                __typename
                ... on User {
                  login
                }
                ... on Bot {
                  login
                }
                ... on Mannequin {
                  login
                }
              }
            }
            ... on ReadyForReviewEvent {
              createdAt
              actor {
                login
              }
            }
            ... on ConvertToDraftEvent {
              createdAt
              actor {
                login
              }
            }
            ... on ReviewDismissedEvent {
              createdAt
              actor {
                login
              }
            }
            ... on DeployedEvent {
              createdAt
              actor {
                login
              }
              deployment {
                environment
              }
            }
            ... on ClosedEvent {
              createdAt
              actor {
                login
              }
            }
            ... on ReopenedEvent {
              createdAt
              actor {
                login
              }
            }
            ... on MergedEvent {
              createdAt
              actor {
                login
              }
            }
            ... on HeadRefForcePushedEvent {
              createdAt
              actor {
                login
              }
            }
          }
        }
      }
    }
  }
`)

const GetPullRequestCommitsQuery = graphql(`
  query GetPullRequestCommits(
    $owner: String!
    $repo: String!
    $number: Int!
    $cursor: String
  ) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        commits(first: 100, after: $cursor) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            commit {
              oid
              commitUrl
              committedDate
              committer {
                user {
                  login
                }
              }
            }
          }
        }
      }
    }
  }
`)

const GetPullRequestReviewsQuery = graphql(`
  query GetPullRequestReviews(
    $owner: String!
    $repo: String!
    $number: Int!
    $cursor: String
  ) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        reviews(first: 100, after: $cursor) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            databaseId
            state
            url
            submittedAt
            author {
              __typename
              login
            }
          }
        }
      }
    }
  }
`)

const GetPullRequestCommentsQuery = graphql(`
  query GetPullRequestComments(
    $owner: String!
    $repo: String!
    $number: Int!
    $commentsCursor: String
    $reviewThreadsCursor: String
  ) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        comments(first: 100, after: $commentsCursor) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            databaseId
            url
            createdAt
            author {
              __typename
              login
            }
          }
        }
        reviewThreads(first: 100, after: $reviewThreadsCursor) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            comments(first: 100) {
              nodes {
                databaseId
                url
                createdAt
                author {
                  __typename
                  login
                }
              }
            }
          }
        }
      }
    }
  }
`)

/**
 * PR + commits + reviews + comments を一括取得するネストクエリ
 * N+1 問題を解消し、API コール数を大幅削減
 */
/**
 * ノード数計算:
 * - PRs: 25
 * - 各 PR: assignees(10) + reviewRequests(10) + commits(100) + reviews(100) + comments(100) + reviewThreads(50)
 * - reviewThreads 内: comments(20)
 * 最大ノード数: 25 × (10 + 10 + 100 + 100 + 100 + 50 × 20) = 25 × 1,320 = 33,000 (十分に 500,000 以下)
 */
const GetPullRequestsWithDetailsQuery = graphql(`
  query GetPullRequestsWithDetails(
    $owner: String!
    $repo: String!
    $cursor: String
    $first: Int = 25
  ) {
    repository(owner: $owner, name: $repo) {
      pullRequests(
        first: $first
        after: $cursor
        orderBy: { field: CREATED_AT, direction: DESC }
      ) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          databaseId
          number
          state
          title
          body
          url
          isDraft
          createdAt
          updatedAt
          mergedAt
          closedAt
          additions
          deletions
          changedFiles
          headRefName
          baseRefName
          mergeCommit {
            oid
          }
          author {
            __typename
            login
          }
          assignees(first: 10) {
            nodes {
              login
            }
          }
          reviewRequests(first: 10) {
            nodes {
              requestedReviewer {
                __typename
                ... on User {
                  login
                }
                ... on Bot {
                  login
                }
                ... on Mannequin {
                  login
                }
              }
            }
          }
          timelineItems(
            first: 50
            itemTypes: [
              REVIEW_REQUESTED_EVENT
              REVIEW_REQUEST_REMOVED_EVENT
              READY_FOR_REVIEW_EVENT
              CONVERT_TO_DRAFT_EVENT
              REVIEW_DISMISSED_EVENT
              DEPLOYED_EVENT
              CLOSED_EVENT
              REOPENED_EVENT
              MERGED_EVENT
              HEAD_REF_FORCE_PUSHED_EVENT
            ]
          ) {
            pageInfo {
              hasNextPage
            }
            nodes {
              __typename
              ... on ReviewRequestedEvent {
                createdAt
                requestedReviewer {
                  __typename
                  ... on User {
                    login
                  }
                  ... on Bot {
                    login
                  }
                  ... on Mannequin {
                    login
                  }
                }
              }
              ... on ReviewRequestRemovedEvent {
                createdAt
                requestedReviewer {
                  __typename
                  ... on User {
                    login
                  }
                  ... on Bot {
                    login
                  }
                  ... on Mannequin {
                    login
                  }
                }
              }
              ... on ReadyForReviewEvent {
                createdAt
                actor {
                  login
                }
              }
              ... on ConvertToDraftEvent {
                createdAt
                actor {
                  login
                }
              }
              ... on ReviewDismissedEvent {
                createdAt
                actor {
                  login
                }
              }
              ... on DeployedEvent {
                createdAt
                actor {
                  login
                }
                deployment {
                  environment
                }
              }
              ... on ClosedEvent {
                createdAt
                actor {
                  login
                }
              }
              ... on ReopenedEvent {
                createdAt
                actor {
                  login
                }
              }
              ... on MergedEvent {
                createdAt
                actor {
                  login
                }
              }
              ... on HeadRefForcePushedEvent {
                createdAt
                actor {
                  login
                }
              }
            }
          }
          # ネストして取得
          commits(first: 100) {
            pageInfo {
              hasNextPage
            }
            nodes {
              commit {
                oid
                commitUrl
                committedDate
                committer {
                  user {
                    login
                  }
                }
              }
            }
          }
          reviews(first: 100) {
            pageInfo {
              hasNextPage
            }
            nodes {
              databaseId
              state
              url
              submittedAt
              author {
                __typename
                login
              }
            }
          }
          comments(first: 100) {
            pageInfo {
              hasNextPage
            }
            nodes {
              databaseId
              url
              createdAt
              author {
                __typename
                login
              }
            }
          }
          reviewThreads(first: 50) {
            pageInfo {
              hasNextPage
            }
            nodes {
              comments(first: 20) {
                pageInfo {
                  hasNextPage
                }
                nodes {
                  databaseId
                  url
                  createdAt
                  author {
                    __typename
                    login
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`)

const GetTagsQuery = graphql(`
  query GetTags($owner: String!, $repo: String!, $cursor: String) {
    repository(owner: $owner, name: $repo) {
      refs(refPrefix: "refs/tags/", first: 100, after: $cursor) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          name
          target {
            __typename
            oid
            ... on Commit {
              committedDate
            }
            ... on Tag {
              tagger {
                date
              }
              target {
                __typename
                ... on Commit {
                  oid
                  committedDate
                }
              }
            }
          }
        }
      }
    }
  }
`)

/**
 * GitHub GraphQL の 502/504 タイムアウトに対してページサイズを縮小してリトライする。
 * @returns 'retry' ならページサイズ縮小済みで continue すべき、それ以外は結果 or throw
 */
/** error から HTTP status を取り出す */
function getErrorStatus(error: unknown): number | null {
  return error && typeof error === 'object' && 'status' in error
    ? (error as { status: number }).status
    : null
}

/** error が transient (502/504) かどうか */
function isTransientError(error: unknown): boolean {
  const status = getErrorStatus(error)
  return status === 502 || status === 504
}

/** error から partial data を取り出す（GraphQL の data + errors レスポンス） */
function getPartialData<T>(error: unknown): T | null {
  if (
    error &&
    typeof error === 'object' &&
    'data' in error &&
    error.data != null
  ) {
    return error.data as T
  }
  return null
}

function handleGraphQLError<T>(
  error: unknown,
  pageSize: { value: number },
  minPageSize: number,
  label: string,
): { action: 'retry' } | { action: 'use'; data: T } {
  // HTTP 502/504 → ページサイズ削減してリトライ
  if (isTransientError(error) && pageSize.value > minPageSize) {
    pageSize.value = Math.max(minPageSize, Math.floor(pageSize.value / 2))
    logger.warn(
      `${label}: GitHub API timeout (${getErrorStatus(error)}), reducing page size to ${pageSize.value}`,
    )
    return { action: 'retry' }
  }

  // GraphQL partial error (data + errors)
  const partialData = getPartialData<T>(error)
  if (partialData != null) {
    // data はあるが中身が空の場合はタイムアウト起因の可能性が高い
    const repo =
      partialData &&
      typeof partialData === 'object' &&
      'repository' in partialData
        ? (partialData as { repository: unknown }).repository
        : undefined
    if (!repo && pageSize.value > minPageSize) {
      pageSize.value = Math.max(minPageSize, Math.floor(pageSize.value / 2))
      logger.warn(
        `${label}: partial error with null repository, reducing page size to ${pageSize.value}`,
      )
      return { action: 'retry' }
    }
    logger.warn(
      `${label}: GraphQL partial error`,
      error && typeof error === 'object' && 'errors' in error
        ? JSON.stringify((error as { errors: unknown }).errors)
        : '',
    )
    return { action: 'use', data: partialData }
  }

  throw error
}

/**
 * GraphQL の timelineItems ノードを ShapedTimelineItem[] に変換
 */
function shapeTimelineNodes(
  nodes: readonly (Record<string, unknown> | null)[],
): ShapedTimelineItem[] {
  const items: ShapedTimelineItem[] = []
  for (const node of nodes) {
    if (!node || !('__typename' in node) || !('createdAt' in node)) continue
    const type = node.__typename as string
    const createdAt = node.createdAt as string

    // ReviewRequestedEvent / ReviewRequestRemovedEvent: reviewer 情報
    if ('requestedReviewer' in node && node.requestedReviewer) {
      const rr = node.requestedReviewer as {
        __typename?: 'User' | 'Bot' | 'Mannequin'
        login?: string
        name?: string
      }
      items.push({
        type,
        createdAt,
        reviewer: rr.login ?? rr.name ?? null,
        reviewerType: rr.__typename ?? null,
      })
      continue
    }

    // DeployedEvent: environment 情報
    if ('deployment' in node && node.deployment) {
      const dep = node.deployment as { environment?: string }
      items.push({
        type,
        createdAt,
        actor: (node.actor as { login?: string } | null)?.login ?? null,
        environment: dep.environment ?? null,
      })
      continue
    }

    // その他: actor 情報
    items.push({
      type,
      createdAt,
      actor: (node.actor as { login?: string } | null)?.login ?? null,
    })
  }
  return items
}

/**
 * ShapedTimelineItem[] から login → 最新の requestedAt マッピングを構築
 */
export function buildRequestedAtMap(
  items: ShapedTimelineItem[],
): Map<string, string> {
  const map = new Map<string, string>()
  for (const item of items) {
    if (item.type !== 'ReviewRequestedEvent' || !item.reviewer) continue
    const existing = map.get(item.reviewer)
    if (!existing || item.createdAt > existing) {
      map.set(item.reviewer, item.createdAt)
    }
  }
  return map
}

function shapePullRequestNode(
  node: {
    databaseId?: number | null
    number: number
    state: string
    title: string
    body?: string | null
    url: string
    isDraft: boolean
    createdAt: string
    updatedAt: string
    mergedAt?: string | null
    closedAt?: string | null
    additions?: number | null
    deletions?: number | null
    changedFiles?: number | null
    headRefName: string
    baseRefName: string
    mergeCommit?: { oid: string } | null
    author?: { __typename: string; login: string } | null
    assignees: { nodes?: Array<{ login: string } | null> | null }
    reviewRequests?: {
      nodes?: Array<{
        requestedReviewer?: {
          __typename: string
          login?: string
        } | null
      } | null> | null
    } | null
  } | null,
  owner: string,
  repo: string,
): ShapedGitHubPullRequest | null {
  if (!node || !node.databaseId) return null

  const state = node.state === 'OPEN' ? 'open' : ('closed' as 'open' | 'closed')

  const reviewers: { login: string; requestedAt: string | null }[] = []
  if (node.reviewRequests?.nodes) {
    for (const rr of node.reviewRequests.nodes) {
      const reviewer = rr?.requestedReviewer
      if (
        reviewer?.login &&
        (reviewer.__typename === 'User' ||
          reviewer.__typename === 'Bot' ||
          reviewer.__typename === 'Mannequin')
      ) {
        reviewers.push({ login: reviewer.login, requestedAt: null })
      }
    }
  }

  return {
    id: node.databaseId,
    organization: owner,
    repo,
    number: node.number,
    state,
    title: node.title,
    body: node.body ?? null,
    url: node.url,
    author: node.author?.login ?? null,
    authorIsBot: node.author?.__typename === 'Bot',
    assignees:
      node.assignees.nodes?.filter((n) => n != null).map((n) => n.login) ?? [],
    reviewers,
    draft: node.isDraft,
    sourceBranch: node.headRefName,
    targetBranch: node.baseRefName,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
    mergedAt: node.mergedAt ?? null,
    closedAt: node.closedAt ?? null,
    mergeCommitSha: node.mergeCommit?.oid ?? null,
    additions: node.additions ?? null,
    deletions: node.deletions ?? null,
    changedFiles: node.changedFiles ?? null,
    files: [],
  }
}

interface createFetcherProps {
  owner: string
  repo: string
  octokit: Octokit
}
const REQUEST_TIMEOUT_MS = 30_000

/** GraphQL のタグ node から ShapedGitHubTag を生成する純粋関数 */
export function shapeTagNode(node: {
  name: string
  target: {
    __typename: string
    oid: string
    committedDate?: string | null
    tagger?: { date: string | null } | null
    target?: {
      __typename: string
      oid?: string
      committedDate?: string | null
    } | null
  } | null
}): ShapedGitHubTag | null {
  const target = node.target
  if (!target) return null

  let sha: string
  let committedDate: string | null | undefined

  if (target.__typename === 'Tag') {
    const innerTarget = target.target
    if (innerTarget?.__typename === 'Commit' && innerTarget.oid) {
      sha = innerTarget.oid
      // tagger.date を優先（annotated tag のタグ作成日時）、UTC に正規化
      const rawDate = target.tagger?.date ?? innerTarget.committedDate
      committedDate = rawDate ? dayjs(rawDate).utc().toISOString() : rawDate
    } else {
      return null
    }
  } else if (target.__typename === 'Commit') {
    sha = target.oid
    committedDate = target.committedDate
  } else {
    return null
  }

  if (!committedDate) return null
  return { name: node.name, sha, committedAt: committedDate }
}

export const createFetcher = ({ owner, repo, octokit }: createFetcherProps) => {
  /** タイムアウト付き GraphQL リクエスト */
  async function graphqlWithTimeout<T>(
    query: string,
    variables: Record<string, unknown>,
    maxRetries = 2,
  ): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await Promise.race([
          octokit.graphql<T>(query, variables),
          new Promise<never>((_, reject) =>
            setTimeout(
              () =>
                reject(
                  Object.assign(new Error('GraphQL request timeout'), {
                    status: 504,
                  }),
                ),
              REQUEST_TIMEOUT_MS,
            ),
          ),
        ])
      } catch (error) {
        if (isTransientError(error) && attempt < maxRetries) {
          logger.warn(
            `GraphQL transient error (${getErrorStatus(error)}), retrying (${attempt + 1}/${maxRetries})...`,
          )
          continue
        }
        throw error
      }
    }
  }

  /**
   * プロジェクトのすべてのプルリク情報を GraphQL で取得
   * @returns プロジェクトのすべてのプルリク情報の配列
   */
  const pullrequests = async () => {
    type PullRequestsResult = ResultOf<typeof GetPullRequestsQuery>

    const queryStr = print(GetPullRequestsQuery)
    const allPulls: ShapedGitHubPullRequest[] = []
    let cursor: string | null = null
    let hasNextPage = true
    const pageSizeRef = { value: 100 }

    while (hasNextPage) {
      let result: PullRequestsResult
      try {
        result = await graphqlWithTimeout<PullRequestsResult>(queryStr, {
          owner,
          repo,
          cursor,
          first: pageSizeRef.value,
        })
      } catch (error: unknown) {
        const handled = handleGraphQLError<PullRequestsResult>(
          error,
          pageSizeRef,
          10,
          'pullrequests()',
        )
        if (handled.action === 'retry') continue
        result = handled.data
      }

      const pullRequests = result?.repository?.pullRequests
      if (!pullRequests || !pullRequests.nodes) {
        // 200 OK だが repository が null → タイムアウト起因の可能性
        if (pageSizeRef.value > 10) {
          pageSizeRef.value = Math.max(10, Math.floor(pageSizeRef.value / 2))
          logger.warn(
            `pullrequests(): empty response, reducing page size to ${pageSizeRef.value}`,
          )
          continue
        }
        logger.warn(
          'pullrequests(): unexpected empty response (already at min page size)',
          JSON.stringify({
            hasRepository: !!result?.repository,
            hasPullRequests: !!pullRequests,
            hasNodes: !!pullRequests?.nodes,
            pageSize: pageSizeRef.value,
            cursor,
          }),
        )
        break
      }

      for (const node of pullRequests.nodes) {
        const shaped = shapePullRequestNode(node, owner, repo)
        if (shaped) allPulls.push(shaped)
      }

      hasNextPage = pullRequests.pageInfo.hasNextPage
      cursor = pullRequests.pageInfo.endCursor ?? null
    }

    return allPulls
  }

  /**
   * stopBefore が指定されると、updatedAt がそれより古い PR が出た時点でページング停止
   */
  const pullrequestList = async (stopBefore?: string) => {
    type ListResult = ResultOf<typeof GetPullRequestListQuery>

    const queryStr = print(GetPullRequestListQuery)
    const items: Array<{ number: number; updatedAt: string }> = []
    let cursor: string | null = null
    let hasNextPage = true
    const pageSizeRef = { value: 100 }

    while (hasNextPage) {
      let result: ListResult
      try {
        result = await graphqlWithTimeout<ListResult>(queryStr, {
          owner,
          repo,
          cursor,
          first: pageSizeRef.value,
        })
      } catch (error: unknown) {
        const handled = handleGraphQLError<ListResult>(
          error,
          pageSizeRef,
          10,
          'pullrequestList()',
        )
        if (handled.action === 'retry') continue
        result = handled.data
      }

      const pullRequests = result?.repository?.pullRequests
      if (!pullRequests?.nodes) {
        if (pageSizeRef.value > 10) {
          pageSizeRef.value = Math.max(10, Math.floor(pageSizeRef.value / 2))
          logger.warn(
            `pullrequestList(): empty response, reducing page size to ${pageSizeRef.value}`,
          )
          continue
        }
        logger.warn(
          'pullrequestList(): unexpected empty response (already at min page size)',
          JSON.stringify({
            hasRepository: !!result?.repository,
            hasPullRequests: !!pullRequests,
            hasNodes: !!pullRequests?.nodes,
            pageSize: pageSizeRef.value,
            cursor,
          }),
        )
        break
      }

      let stopped = false
      for (const node of pullRequests.nodes) {
        if (!node) continue
        // ISO 8601 UTC 文字列同士なので lexicographic 比較 = 時系列比較
        if (stopBefore && node.updatedAt < stopBefore) {
          stopped = true
          break
        }
        items.push({ number: node.number, updatedAt: node.updatedAt })
      }

      if (stopped) break
      hasNextPage = pullRequests.pageInfo.hasNextPage
      cursor = pullRequests.pageInfo.endCursor ?? null
    }

    return items
  }

  const pullrequest = async (
    pullNumber: number,
  ): Promise<ShapedGitHubPullRequest> => {
    type PRResult = ResultOf<typeof GetPullRequestQuery>

    const queryStr = print(GetPullRequestQuery)
    const result = await graphqlWithTimeout<PRResult>(queryStr, {
      owner,
      repo,
      number: pullNumber,
    })

    const node = result?.repository?.pullRequest ?? null
    const shaped = shapePullRequestNode(node, owner, repo)
    if (!shaped) {
      throw new Error(`PR #${pullNumber} not found in ${owner}/${repo}`)
    }
    return shaped
  }

  const commits = async (pullNumber: number) => {
    type CommitsResult = ResultOf<typeof GetPullRequestCommitsQuery>

    const queryStr = print(GetPullRequestCommitsQuery)
    const allCommits: ShapedGitHubCommit[] = []
    let cursor: string | null = null
    let hasNextPage = true

    while (hasNextPage) {
      const result: CommitsResult = await graphqlWithTimeout<CommitsResult>(
        queryStr,
        { owner, repo, number: pullNumber, cursor },
      )

      const commits = result.repository?.pullRequest?.commits
      if (!commits || !commits.nodes) break

      for (const node of commits.nodes) {
        if (!node) continue
        const c = node.commit

        allCommits.push({
          sha: c.oid,
          url: c.commitUrl,
          committer: c.committer?.user?.login ?? null,
          date: c.committedDate,
        })
      }

      hasNextPage = commits.pageInfo.hasNextPage
      cursor = commits.pageInfo.endCursor ?? null
    }

    return allCommits
  }

  /**
   * PR の issue comments と review comments を GraphQL で一括取得
   */
  const comments = async (pullNumber: number) => {
    type CommentsResult = ResultOf<typeof GetPullRequestCommentsQuery>

    const queryStr = print(GetPullRequestCommentsQuery)

    // issue comments
    const issueComments: ShapedGitHubIssueComment[] = []
    let commentsCursor: string | null = null
    let hasMoreComments = true

    while (hasMoreComments) {
      const result: CommentsResult = await graphqlWithTimeout<CommentsResult>(
        queryStr,
        {
          owner,
          repo,
          number: pullNumber,
          commentsCursor,
          reviewThreadsCursor: null,
        },
      )

      const comments = result.repository?.pullRequest?.comments
      if (!comments || !comments.nodes) break

      for (const node of comments.nodes) {
        if (!node || !node.databaseId) continue
        issueComments.push({
          id: node.databaseId,
          user: node.author?.login ?? null,
          isBot: node.author?.__typename === 'Bot',
          url: node.url,
          createdAt: node.createdAt,
        })
      }

      hasMoreComments = comments.pageInfo.hasNextPage
      commentsCursor = comments.pageInfo.endCursor ?? null
    }

    // review comments (via reviewThreads)
    const reviewComments: ShapedGitHubReviewComment[] = []
    let reviewThreadsCursor: string | null = null
    let hasMoreThreads = true

    while (hasMoreThreads) {
      const result: CommentsResult = await graphqlWithTimeout<CommentsResult>(
        queryStr,
        {
          owner,
          repo,
          number: pullNumber,
          commentsCursor: null,
          reviewThreadsCursor,
        },
      )

      const reviewThreads = result.repository?.pullRequest?.reviewThreads
      if (!reviewThreads || !reviewThreads.nodes) break

      for (const thread of reviewThreads.nodes) {
        if (!thread?.comments?.nodes) continue
        for (const node of thread.comments.nodes) {
          if (!node || !node.databaseId) continue
          reviewComments.push({
            id: node.databaseId,
            user: node.author?.login ?? null,
            isBot: node.author?.__typename === 'Bot',
            url: node.url,
            createdAt: node.createdAt,
          })
        }
      }

      hasMoreThreads = reviewThreads.pageInfo.hasNextPage
      reviewThreadsCursor = reviewThreads.pageInfo.endCursor ?? null
    }

    const allComments = [...issueComments, ...reviewComments] as (
      | ShapedGitHubIssueComment
      | ShapedGitHubReviewComment
    )[]
    allComments.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    return allComments
  }

  const reviews = async (pullNumber: number) => {
    type ReviewsResult = ResultOf<typeof GetPullRequestReviewsQuery>

    const queryStr = print(GetPullRequestReviewsQuery)
    const allReviews: ShapedGitHubReview[] = []
    let cursor: string | null = null
    let hasNextPage = true

    while (hasNextPage) {
      const result: ReviewsResult = await graphqlWithTimeout<ReviewsResult>(
        queryStr,
        { owner, repo, number: pullNumber, cursor },
      )

      const reviews = result.repository?.pullRequest?.reviews
      if (!reviews || !reviews.nodes) break

      for (const node of reviews.nodes) {
        if (!node || !node.databaseId) continue

        allReviews.push({
          id: node.databaseId,
          user: node.author?.login ?? null,
          isBot: node.author?.__typename === 'Bot',
          state: node.state,
          url: node.url,
          submittedAt: node.submittedAt ?? null,
        })
      }

      hasNextPage = reviews.pageInfo.hasNextPage
      cursor = reviews.pageInfo.endCursor ?? null
    }

    return allReviews
  }

  /** タグ一覧 + コミット日時を GraphQL で一括取得 */
  const tags = async () => {
    type TagsResult = ResultOf<typeof GetTagsQuery>

    const queryStr = print(GetTagsQuery)
    const allTags: ShapedGitHubTag[] = []
    let cursor: string | null = null
    let hasNextPage = true

    while (hasNextPage) {
      const result: TagsResult = await graphqlWithTimeout<TagsResult>(
        queryStr,
        {
          owner,
          repo,
          cursor,
        },
      )

      const refs = result.repository?.refs
      if (!refs || !refs.nodes) break

      for (const node of refs.nodes) {
        if (!node) continue
        const shaped = shapeTagNode(node)
        if (shaped) allTags.push(shaped)
      }

      hasNextPage = refs.pageInfo.hasNextPage
      cursor = refs.pageInfo.endCursor ?? null
    }

    return allTags
  }

  /**
   * PR + commits + reviews + comments を一括取得（N+1 問題解消版）
   * 各 PR の関連データが 100 件を超える場合は needsMore* フラグで通知
   */
  const pullrequestsWithDetails = async (): Promise<
    ShapedGitHubPullRequestWithDetails[]
  > => {
    type Result = ResultOf<typeof GetPullRequestsWithDetailsQuery>

    const queryStr = print(GetPullRequestsWithDetailsQuery)
    const allResults: ShapedGitHubPullRequestWithDetails[] = []
    let cursor: string | null = null
    let hasNextPage = true
    const pageSizeRef = { value: 25 }

    while (hasNextPage) {
      let result: Result
      try {
        result = await graphqlWithTimeout<Result>(queryStr, {
          owner,
          repo,
          cursor,
          first: pageSizeRef.value,
        })
      } catch (error: unknown) {
        const handled = handleGraphQLError<Result>(
          error,
          pageSizeRef,
          5,
          'pullrequestsWithDetails()',
        )
        if (handled.action === 'retry') continue
        result = handled.data
      }

      const pullRequests = result?.repository?.pullRequests
      if (!pullRequests || !pullRequests.nodes) {
        if (pageSizeRef.value > 5) {
          pageSizeRef.value = Math.max(5, Math.floor(pageSizeRef.value / 2))
          logger.warn(
            `pullrequestsWithDetails(): empty response, reducing page size to ${pageSizeRef.value}`,
          )
          continue
        }
        logger.warn(
          'pullrequestsWithDetails(): empty response at min page size, stopping',
        )
        break
      }

      for (const node of pullRequests.nodes) {
        if (!node || !node.databaseId) continue

        // PR 基本情報
        const state =
          node.state === 'OPEN' ? 'open' : ('closed' as 'open' | 'closed')

        // timelineItems をローデータとしてパース
        const prTimelineItems = node.timelineItems?.nodes
          ? shapeTimelineNodes(
              node.timelineItems.nodes as readonly (Record<
                string,
                unknown
              > | null)[],
            )
          : []
        const requestedAtMap = buildRequestedAtMap(prTimelineItems)

        // reviewRequests（現在の pending reviewer）と requestedAt を統合
        const reviewers: { login: string; requestedAt: string | null }[] = []
        if (node.reviewRequests?.nodes) {
          for (const rr of node.reviewRequests.nodes) {
            const reviewer = rr?.requestedReviewer
            if (
              reviewer &&
              (reviewer.__typename === 'User' ||
                reviewer.__typename === 'Bot' ||
                reviewer.__typename === 'Mannequin')
            ) {
              reviewers.push({
                login: reviewer.login,
                requestedAt: requestedAtMap.get(reviewer.login) ?? null,
              })
            }
          }
        }

        const pr: ShapedGitHubPullRequest = {
          id: node.databaseId,
          organization: owner,
          repo,
          number: node.number,
          state,
          title: node.title,
          body: node.body ?? null,
          url: node.url,
          author: node.author?.login ?? null,
          authorIsBot: node.author?.__typename === 'Bot',
          assignees:
            node.assignees.nodes
              ?.filter((n) => n != null)
              .map((n) => n.login) ?? [],
          reviewers,
          draft: node.isDraft,
          sourceBranch: node.headRefName,
          targetBranch: node.baseRefName,
          createdAt: node.createdAt,
          updatedAt: node.updatedAt,
          mergedAt: node.mergedAt ?? null,
          closedAt: node.closedAt ?? null,
          mergeCommitSha: node.mergeCommit?.oid ?? null,
          additions: node.additions ?? null,
          deletions: node.deletions ?? null,
          changedFiles: node.changedFiles ?? null,
          files: [],
        }

        // commits
        const prCommits: ShapedGitHubCommit[] = []
        if (node.commits?.nodes) {
          for (const commitNode of node.commits.nodes) {
            if (!commitNode) continue
            const c = commitNode.commit
            prCommits.push({
              sha: c.oid,
              url: c.commitUrl,
              committer: c.committer?.user?.login ?? null,
              date: c.committedDate,
            })
          }
        }

        // reviews
        const prReviews: ShapedGitHubReview[] = []
        if (node.reviews?.nodes) {
          for (const reviewNode of node.reviews.nodes) {
            if (!reviewNode || !reviewNode.databaseId) continue
            prReviews.push({
              id: reviewNode.databaseId,
              user: reviewNode.author?.login ?? null,
              isBot: reviewNode.author?.__typename === 'Bot',
              state: reviewNode.state,
              url: reviewNode.url,
              submittedAt: reviewNode.submittedAt ?? null,
            })
          }
        }

        // comments (issue comments + review thread comments)
        const prComments: (
          | ShapedGitHubIssueComment
          | ShapedGitHubReviewComment
        )[] = []

        // issue comments
        if (node.comments?.nodes) {
          for (const commentNode of node.comments.nodes) {
            if (!commentNode || !commentNode.databaseId) continue
            prComments.push({
              id: commentNode.databaseId,
              user: commentNode.author?.login ?? null,
              isBot: commentNode.author?.__typename === 'Bot',
              url: commentNode.url,
              createdAt: commentNode.createdAt,
            })
          }
        }

        // review thread comments
        let needsMoreReviewThreadComments = false
        if (node.reviewThreads?.nodes) {
          for (const thread of node.reviewThreads.nodes) {
            if (!thread?.comments) continue
            if (thread.comments.pageInfo.hasNextPage) {
              needsMoreReviewThreadComments = true
            }
            if (!thread.comments.nodes) continue
            for (const commentNode of thread.comments.nodes) {
              if (!commentNode || !commentNode.databaseId) continue
              prComments.push({
                id: commentNode.databaseId,
                user: commentNode.author?.login ?? null,
                isBot: commentNode.author?.__typename === 'Bot',
                url: commentNode.url,
                createdAt: commentNode.createdAt,
              })
            }
          }
        }

        // コメントを時系列でソート
        prComments.sort((a, b) => a.createdAt.localeCompare(b.createdAt))

        allResults.push({
          pr,
          commits: prCommits,
          reviews: prReviews,
          comments: prComments,
          timelineItems: prTimelineItems,
          needsMoreCommits: node.commits?.pageInfo.hasNextPage ?? false,
          needsMoreReviews: node.reviews?.pageInfo.hasNextPage ?? false,
          needsMoreComments: node.comments?.pageInfo.hasNextPage ?? false,
          needsMoreReviewThreads:
            node.reviewThreads?.pageInfo.hasNextPage ?? false,
          needsMoreReviewThreadComments,
          needsMoreTimelineItems:
            node.timelineItems?.pageInfo.hasNextPage ?? false,
        })
      }

      hasNextPage = pullRequests.pageInfo.hasNextPage
      cursor = pullRequests.pageInfo.endCursor ?? null
    }

    return allResults
  }

  /**
   * 単一 PR の timeline items をローデータとして取得
   */
  const timelineItems = async (
    pullNumber: number,
  ): Promise<ShapedTimelineItem[]> => {
    type Result = ResultOf<typeof GetPullRequestTimelineQuery>

    const queryStr = print(GetPullRequestTimelineQuery)
    const result = await graphqlWithTimeout<Result>(queryStr, {
      owner,
      repo,
      number: pullNumber,
    })

    const nodes = result.repository?.pullRequest?.timelineItems?.nodes
    if (!nodes) return []

    return shapeTimelineNodes(nodes)
  }

  /**
   * PR のファイル一覧を REST API で取得
   */
  const files = async (pullNumber: number) => {
    const allFiles: { path: string; additions: number; deletions: number }[] =
      []
    let page = 1

    while (true) {
      const { data } = await octokit.rest.pulls.listFiles({
        owner,
        repo,
        pull_number: pullNumber,
        per_page: 100,
        page,
      })
      if (data.length === 0) break

      for (const f of data) {
        allFiles.push({
          path: f.filename,
          additions: f.additions,
          deletions: f.deletions,
        })
      }

      if (data.length < 100) break
      page++
    }

    return allFiles
  }

  return {
    pullrequests,
    pullrequestList,
    pullrequest,
    pullrequestsWithDetails,
    commits,
    comments,
    reviews,
    timelineItems,
    files,
    tags,
  }
}
