import { print } from 'graphql'
import { Octokit } from 'octokit'
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
          url
          isDraft
          createdAt
          updatedAt
          mergedAt
          additions
          deletions
          changedFiles
          files(first: 100) {
            nodes {
              path
              additions
              deletions
            }
          }
          headRefName
          baseRefName
          mergeCommit {
            oid
          }
          author {
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
          timelineItems(first: 20, itemTypes: [REVIEW_REQUESTED_EVENT]) {
            nodes {
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
          url
          isDraft
          createdAt
          updatedAt
          mergedAt
          additions
          deletions
          changedFiles
          files(first: 100) {
            nodes {
              path
              additions
              deletions
            }
          }
          headRefName
          baseRefName
          mergeCommit {
            oid
          }
          author {
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
          timelineItems(first: 20, itemTypes: [REVIEW_REQUESTED_EVENT]) {
            nodes {
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
function handleGraphQLError<T>(
  error: unknown,
  pageSize: { value: number },
  minPageSize: number,
  label: string,
): { action: 'retry' } | { action: 'use'; data: T } {
  const status =
    error && typeof error === 'object' && 'status' in error
      ? (error as { status: number }).status
      : null

  // HTTP 502/504
  if ((status === 502 || status === 504) && pageSize.value > minPageSize) {
    pageSize.value = Math.max(minPageSize, Math.floor(pageSize.value / 2))
    logger.warn(
      `${label}: GitHub API timeout (${status}), reducing page size to ${pageSize.value}`,
    )
    return { action: 'retry' }
  }

  // GraphQL partial error (data + errors)
  if (
    error &&
    typeof error === 'object' &&
    'data' in error &&
    error.data != null
  ) {
    const partialData = error.data as T
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
      'errors' in error ? JSON.stringify(error.errors) : '',
    )
    return { action: 'use', data: partialData }
  }

  throw error
}

interface createFetcherProps {
  owner: string
  repo: string
  token: string
}
export const createFetcher = ({ owner, repo, token }: createFetcherProps) => {
  const octokit = new Octokit({ auth: token })

  /**
   * プロジェクトのすべてのプルリク情報を GraphQL で取得
   * @returns プロジェクトのすべてのプルリク情報の配列
   */
  const pullrequests = async () => {
    type PullRequestsResult = ResultOf<typeof GetPullRequestsQuery>

    const queryStr = print(GetPullRequestsQuery)
    let allPulls: ShapedGitHubPullRequest[] = []
    let cursor: string | null = null
    let hasNextPage = true
    const pageSizeRef = { value: 50 }

    while (hasNextPage) {
      let result: PullRequestsResult
      try {
        result = await octokit.graphql<PullRequestsResult>(queryStr, {
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
        logger.warn(
          'pullrequests(): unexpected empty response',
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
        if (!node || !node.databaseId) continue

        // GraphQL state は OPEN/CLOSED/MERGED、REST 互換で open/closed に変換
        const state =
          node.state === 'OPEN' ? 'open' : ('closed' as 'open' | 'closed')

        // timelineItems から login → 最新の requestedAt マッピングを構築
        const requestedAtMap = new Map<string, string>()
        if (node.timelineItems?.nodes) {
          for (const item of node.timelineItems.nodes) {
            if (!item || !('createdAt' in item) || !item.requestedReviewer)
              continue
            const reviewer = item.requestedReviewer
            if (
              reviewer.__typename === 'User' ||
              reviewer.__typename === 'Bot' ||
              reviewer.__typename === 'Mannequin'
            ) {
              // 同じ reviewer に複数回リクエストがある場合は最新を採用
              const existing = requestedAtMap.get(reviewer.login)
              if (!existing || item.createdAt > existing) {
                requestedAtMap.set(reviewer.login, item.createdAt)
              }
            }
          }
        }

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

        allPulls = [
          ...allPulls,
          {
            id: node.databaseId,
            organization: owner,
            repo,
            number: node.number,
            state,
            title: node.title,
            url: node.url,
            author: node.author?.login ?? null,
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
            mergeCommitSha: node.mergeCommit?.oid ?? null,
            additions: node.additions ?? null,
            deletions: node.deletions ?? null,
            changedFiles: node.changedFiles ?? null,
            files:
              node.files?.nodes
                ?.filter((f) => f != null)
                .map((f) => ({
                  path: f.path,
                  additions: f.additions,
                  deletions: f.deletions,
                })) ?? [],
          },
        ]
      }

      hasNextPage = pullRequests.pageInfo.hasNextPage
      cursor = pullRequests.pageInfo.endCursor ?? null
    }

    return allPulls
  }

  const commits = async (pullNumber: number) => {
    type CommitsResult = ResultOf<typeof GetPullRequestCommitsQuery>

    const queryStr = print(GetPullRequestCommitsQuery)
    let allCommits: ShapedGitHubCommit[] = []
    let cursor: string | null = null
    let hasNextPage = true

    while (hasNextPage) {
      const result: CommitsResult = await octokit.graphql<CommitsResult>(
        queryStr,
        { owner, repo, number: pullNumber, cursor },
      )

      const commits = result.repository?.pullRequest?.commits
      if (!commits || !commits.nodes) break

      for (const node of commits.nodes) {
        if (!node) continue
        const c = node.commit

        allCommits = [
          ...allCommits,
          {
            sha: c.oid,
            url: c.commitUrl,
            committer: c.committer?.user?.login ?? null,
            date: c.committedDate,
          },
        ]
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
      const result: CommentsResult = await octokit.graphql<CommentsResult>(
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
      const result: CommentsResult = await octokit.graphql<CommentsResult>(
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
    allComments.sort(
      (a, b) => dayjs(a.createdAt).unix() - dayjs(b.createdAt).unix(),
    )
    return allComments
  }

  const reviews = async (pullNumber: number) => {
    type ReviewsResult = ResultOf<typeof GetPullRequestReviewsQuery>

    const queryStr = print(GetPullRequestReviewsQuery)
    let allReviews: ShapedGitHubReview[] = []
    let cursor: string | null = null
    let hasNextPage = true

    while (hasNextPage) {
      const result: ReviewsResult = await octokit.graphql<ReviewsResult>(
        queryStr,
        { owner, repo, number: pullNumber, cursor },
      )

      const reviews = result.repository?.pullRequest?.reviews
      if (!reviews || !reviews.nodes) break

      for (const node of reviews.nodes) {
        if (!node || !node.databaseId) continue

        allReviews = [
          ...allReviews,
          {
            id: node.databaseId,
            user: node.author?.login ?? null,
            isBot: node.author?.__typename === 'Bot',
            state: node.state,
            url: node.url,
            submittedAt: node.submittedAt ?? null,
          },
        ]
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
    let allTags: ShapedGitHubTag[] = []
    let cursor: string | null = null
    let hasNextPage = true

    while (hasNextPage) {
      const result: TagsResult = await octokit.graphql<TagsResult>(queryStr, {
        owner,
        repo,
        cursor,
      })

      const refs = result.repository?.refs
      if (!refs || !refs.nodes) break

      for (const node of refs.nodes) {
        if (!node) continue
        const target = node.target
        if (!target) continue

        // annotated tag の場合は target.target にコミット情報がある
        let sha: string
        let committedDate: string | null | undefined

        if (target.__typename === 'Tag') {
          const innerTarget = target.target
          if (innerTarget?.__typename === 'Commit') {
            sha = innerTarget.oid
            committedDate = innerTarget.committedDate
          } else {
            continue
          }
        } else if (target.__typename === 'Commit') {
          sha = target.oid
          committedDate = target.committedDate
        } else {
          continue
        }

        if (committedDate) {
          allTags = [
            ...allTags,
            { name: node.name, sha, committedAt: committedDate },
          ]
        }
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
        result = await octokit.graphql<Result>(queryStr, {
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
      if (!pullRequests || !pullRequests.nodes) break

      for (const node of pullRequests.nodes) {
        if (!node || !node.databaseId) continue

        // PR 基本情報
        const state =
          node.state === 'OPEN' ? 'open' : ('closed' as 'open' | 'closed')

        // timelineItems から login → 最新の requestedAt マッピングを構築
        const requestedAtMap = new Map<string, string>()
        if (node.timelineItems?.nodes) {
          for (const item of node.timelineItems.nodes) {
            if (!item || !('createdAt' in item) || !item.requestedReviewer)
              continue
            const reviewer = item.requestedReviewer
            if (
              reviewer.__typename === 'User' ||
              reviewer.__typename === 'Bot' ||
              reviewer.__typename === 'Mannequin'
            ) {
              const existing = requestedAtMap.get(reviewer.login)
              if (!existing || item.createdAt > existing) {
                requestedAtMap.set(reviewer.login, item.createdAt)
              }
            }
          }
        }

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
          url: node.url,
          author: node.author?.login ?? null,
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
          mergeCommitSha: node.mergeCommit?.oid ?? null,
          additions: node.additions ?? null,
          deletions: node.deletions ?? null,
          changedFiles: node.changedFiles ?? null,
          files:
            node.files?.nodes
              ?.filter((f) => f != null)
              .map((f) => ({
                path: f.path,
                additions: f.additions,
                deletions: f.deletions,
              })) ?? [],
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
        prComments.sort(
          (a, b) => dayjs(a.createdAt).unix() - dayjs(b.createdAt).unix(),
        )

        allResults.push({
          pr,
          commits: prCommits,
          reviews: prReviews,
          comments: prComments,
          needsMoreCommits: node.commits?.pageInfo.hasNextPage ?? false,
          needsMoreReviews: node.reviews?.pageInfo.hasNextPage ?? false,
          needsMoreComments: node.comments?.pageInfo.hasNextPage ?? false,
          needsMoreReviewThreads:
            node.reviewThreads?.pageInfo.hasNextPage ?? false,
          needsMoreReviewThreadComments,
        })
      }

      hasNextPage = pullRequests.pageInfo.hasNextPage
      cursor = pullRequests.pageInfo.endCursor ?? null
    }

    return allResults
  }

  return {
    pullrequests,
    pullrequestsWithDetails,
    commits,
    comments,
    reviews,
    tags,
  }
}
