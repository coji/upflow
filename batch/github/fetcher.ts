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

interface PageInfo {
  hasNextPage: boolean
  endCursor?: string | null
}

interface PaginateOptions<TNode> {
  /** ページネーション用の初期ページサイズ（デフォルト: 100） */
  initialPageSize?: number
  /** handleGraphQLError の最小ページサイズ。指定するとエラー時にページサイズ削減+リトライする */
  minPageSize?: number
  /** ラベル（ログ用） */
  label?: string
  /** ノードに対する早期打ち切り判定。true を返すとそのノードでページング停止 */
  shouldStop?: (node: TNode) => boolean
}

/**
 * GraphQL カーソルベースページネーションの共通ヘルパー。
 * extractConnection でレスポンスからノード配列と pageInfo を取り出し、
 * processNode でノードをアイテムに変換する。
 */
export async function paginateGraphQL<TResult, TNode, TItem>(
  graphqlFn: (variables: Record<string, unknown>) => Promise<TResult>,
  extractConnection: (
    result: TResult,
  ) => { nodes: (TNode | null)[] | null; pageInfo: PageInfo } | null,
  processNode: (node: TNode) => TItem | null,
  options: PaginateOptions<TNode> = {},
): Promise<TItem[]> {
  const {
    initialPageSize = 100,
    minPageSize,
    label = 'paginateGraphQL',
    shouldStop,
  } = options
  const items: TItem[] = []
  let cursor: string | null = null
  let hasNextPage = true
  const pageSizeRef = { value: initialPageSize }

  while (hasNextPage) {
    let result: TResult
    const variables = { cursor, first: pageSizeRef.value }

    if (minPageSize != null) {
      // パターン A: handleGraphQLError 付き
      try {
        result = await graphqlFn(variables)
      } catch (error: unknown) {
        const handled = handleGraphQLError<TResult>(
          error,
          pageSizeRef,
          minPageSize,
          label,
        )
        if (handled.action === 'retry') continue
        result = handled.data
      }
    } else {
      // パターン B: シンプル（エラーは呼び出し元に伝播）
      result = await graphqlFn(variables)
    }

    const connection = extractConnection(result)
    const nodes = connection?.nodes
    if (!nodes) {
      if (minPageSize != null && pageSizeRef.value > minPageSize) {
        pageSizeRef.value = Math.max(
          minPageSize,
          Math.floor(pageSizeRef.value / 2),
        )
        logger.warn(
          `${label}: empty response, reducing page size to ${pageSizeRef.value}`,
        )
        continue
      }
      if (minPageSize != null) {
        throw new Error(
          `${label}: empty response at min page size ${pageSizeRef.value} (cursor: ${cursor})`,
        )
      }
      break
    }

    let stopped = false
    for (const node of nodes) {
      if (!node) continue
      if (shouldStop?.(node)) {
        stopped = true
        break
      }
      const item = processNode(node)
      if (item != null) items.push(item)
    }

    if (stopped) break
    hasNextPage = connection.pageInfo.hasNextPage
    cursor = connection.pageInfo.endCursor ?? null
  }

  return items
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

function shapeCommentNode(node: {
  databaseId: number | null
  author: { __typename: string; login: string } | null
  url: string
  createdAt: string
}): ShapedGitHubIssueComment | null {
  if (!node.databaseId) return null
  return {
    id: node.databaseId,
    user: node.author?.login ?? null,
    isBot: node.author?.__typename === 'Bot',
    url: node.url,
    createdAt: node.createdAt,
  }
}

function shapeCommitNode(node: {
  commit: {
    oid: string
    commitUrl: string
    committedDate: string
    committer: { user: { login: string } | null } | null
  }
}): ShapedGitHubCommit {
  return {
    sha: node.commit.oid,
    url: node.commit.commitUrl,
    committer: node.commit.committer?.user?.login ?? null,
    date: node.commit.committedDate,
  }
}

function shapeReviewNode(node: {
  databaseId: number | null
  author: { __typename: string; login: string } | null
  state: ShapedGitHubReview['state']
  url: string
  submittedAt: string | null
}): ShapedGitHubReview | null {
  if (!node.databaseId) return null
  return {
    id: node.databaseId,
    user: node.author?.login ?? null,
    isBot: node.author?.__typename === 'Bot',
    state: node.state,
    url: node.url,
    submittedAt: node.submittedAt ?? null,
  }
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

  const pullrequests = () => {
    type Result = ResultOf<typeof GetPullRequestsQuery>
    type PrNode = NonNullable<
      NonNullable<Result['repository']>['pullRequests']['nodes']
    >[number]
    const queryStr = print(GetPullRequestsQuery)

    return paginateGraphQL<Result, PrNode, ShapedGitHubPullRequest>(
      (vars) => graphqlWithTimeout<Result>(queryStr, { owner, repo, ...vars }),
      (r) => r?.repository?.pullRequests ?? null,
      (node) => shapePullRequestNode(node, owner, repo),
      { minPageSize: 10, label: 'pullrequests()' },
    )
  }

  /**
   * stopBefore が指定されると、updatedAt がそれより古い PR が出た時点でページング停止
   */
  const pullrequestList = (stopBefore?: string) => {
    type Result = ResultOf<typeof GetPullRequestListQuery>
    type Node = { number: number; updatedAt: string }
    const queryStr = print(GetPullRequestListQuery)

    return paginateGraphQL<Result, Node, { number: number; updatedAt: string }>(
      (vars) => graphqlWithTimeout<Result>(queryStr, { owner, repo, ...vars }),
      (r) => r?.repository?.pullRequests ?? null,
      (node) => ({ number: node.number, updatedAt: node.updatedAt }),
      {
        minPageSize: 10,
        label: 'pullrequestList()',
        // ISO 8601 UTC 文字列同士なので lexicographic 比較 = 時系列比較
        shouldStop: stopBefore
          ? (node) => node.updatedAt <= stopBefore
          : undefined,
      },
    )
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

  const commits = (pullNumber: number) => {
    type Result = ResultOf<typeof GetPullRequestCommitsQuery>
    const queryStr = print(GetPullRequestCommitsQuery)

    return paginateGraphQL(
      (vars) =>
        graphqlWithTimeout<Result>(queryStr, {
          owner,
          repo,
          number: pullNumber,
          ...vars,
        }),
      (r) => r.repository?.pullRequest?.commits ?? null,
      shapeCommitNode,
    )
  }

  const comments = async (pullNumber: number) => {
    type Result = ResultOf<typeof GetPullRequestCommentsQuery>
    const queryStr = print(GetPullRequestCommentsQuery)

    // issue comments
    const issueComments = await paginateGraphQL(
      (vars) =>
        graphqlWithTimeout<Result>(queryStr, {
          owner,
          repo,
          number: pullNumber,
          commentsCursor: vars.cursor,
          reviewThreadsCursor: null,
          first: undefined,
        }),
      (r) => r.repository?.pullRequest?.comments ?? null,
      shapeCommentNode,
    )

    // review comments — スレッド→コメントの展開が必要なので手動ループ
    const reviewComments: ShapedGitHubReviewComment[] = []
    let reviewThreadsCursor: string | null = null
    let hasMoreThreads = true

    while (hasMoreThreads) {
      const result: Result = await graphqlWithTimeout<Result>(queryStr, {
        owner,
        repo,
        number: pullNumber,
        commentsCursor: null,
        reviewThreadsCursor,
      })

      const reviewThreads = result.repository?.pullRequest?.reviewThreads
      if (!reviewThreads?.nodes) break

      for (const thread of reviewThreads.nodes) {
        if (!thread?.comments?.nodes) continue
        for (const node of thread.comments.nodes) {
          if (!node) continue
          const shaped = shapeCommentNode(node)
          if (shaped) reviewComments.push(shaped)
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

  const reviews = (pullNumber: number) => {
    type Result = ResultOf<typeof GetPullRequestReviewsQuery>
    const queryStr = print(GetPullRequestReviewsQuery)

    return paginateGraphQL(
      (vars) =>
        graphqlWithTimeout<Result>(queryStr, {
          owner,
          repo,
          number: pullNumber,
          ...vars,
        }),
      (r) => r.repository?.pullRequest?.reviews ?? null,
      shapeReviewNode,
    )
  }

  const tags = () => {
    type Result = ResultOf<typeof GetTagsQuery>
    const queryStr = print(GetTagsQuery)

    return paginateGraphQL(
      (vars) => graphqlWithTimeout<Result>(queryStr, { owner, repo, ...vars }),
      (r) => r.repository?.refs ?? null,
      shapeTagNode,
    )
  }

  /**
   * PR + commits + reviews + comments を一括取得（N+1 問題解消版）
   * 各 PR の関連データが 100 件を超える場合は needsMore* フラグで通知
   */
  const pullrequestsWithDetails = () => {
    type Result = ResultOf<typeof GetPullRequestsWithDetailsQuery>
    type PrDetailNode = NonNullable<
      NonNullable<
        NonNullable<Result['repository']>['pullRequests']['nodes']
      >[number]
    >
    const queryStr = print(GetPullRequestsWithDetailsQuery)

    return paginateGraphQL<
      Result,
      PrDetailNode,
      ShapedGitHubPullRequestWithDetails
    >(
      (vars) => graphqlWithTimeout<Result>(queryStr, { owner, repo, ...vars }),
      (r) => r?.repository?.pullRequests ?? null,
      (node) => {
        const basePr = shapePullRequestNode(node, owner, repo)
        if (!basePr) return null

        // timeline から requestedAt を補完
        const prTimelineItems = node.timelineItems?.nodes
          ? shapeTimelineNodes(
              node.timelineItems.nodes as readonly (Record<
                string,
                unknown
              > | null)[],
            )
          : []
        const requestedAtMap = buildRequestedAtMap(prTimelineItems)
        const pr: ShapedGitHubPullRequest = {
          ...basePr,
          reviewers: basePr.reviewers.map((r) => ({
            ...r,
            requestedAt: requestedAtMap.get(r.login) ?? r.requestedAt,
          })),
        }

        // commits
        const prCommits: ShapedGitHubCommit[] = []
        for (const commitNode of node.commits?.nodes ?? []) {
          if (!commitNode) continue
          prCommits.push(shapeCommitNode(commitNode))
        }

        // reviews
        const prReviews: ShapedGitHubReview[] = []
        for (const reviewNode of node.reviews?.nodes ?? []) {
          if (!reviewNode) continue
          const shaped = shapeReviewNode(reviewNode)
          if (shaped) prReviews.push(shaped)
        }

        // comments (issue comments + review thread comments)
        const prComments: (
          | ShapedGitHubIssueComment
          | ShapedGitHubReviewComment
        )[] = []
        for (const commentNode of node.comments?.nodes ?? []) {
          if (!commentNode) continue
          const shaped = shapeCommentNode(commentNode)
          if (shaped) prComments.push(shaped)
        }

        let needsMoreReviewThreadComments = false
        for (const thread of node.reviewThreads?.nodes ?? []) {
          if (!thread?.comments) continue
          if (thread.comments.pageInfo.hasNextPage) {
            needsMoreReviewThreadComments = true
          }
          for (const commentNode of thread.comments.nodes ?? []) {
            if (!commentNode) continue
            const shaped = shapeCommentNode(commentNode)
            if (shaped) prComments.push(shaped)
          }
        }

        prComments.sort((a, b) => a.createdAt.localeCompare(b.createdAt))

        return {
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
        }
      },
      {
        initialPageSize: 25,
        minPageSize: 5,
        label: 'pullrequestsWithDetails()',
      },
    )
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
