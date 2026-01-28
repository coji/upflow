import { print } from 'graphql'
import { setTimeout } from 'node:timers/promises'
import { Octokit } from 'octokit'
import dayjs from '~/app/libs/dayjs'
import { graphql, type ResultOf } from './graphql'
import type {
  ShapedGitHubCommit,
  ShapedGitHubIssueComment,
  ShapedGitHubPullRequest,
  ShapedGitHubReview,
  ShapedGitHubReviewComment,
  ShapedGitHubTag,
} from './model'
import {
  shapeGitHubCommit,
  shapeGitHubIssueComment,
  shapeGitHubPullRequest,
  shapeGitHubReview,
  shapeGitHubReviewComment,
} from './shaper'

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

const wait = async ({ count, delay }: { count: number; delay: number }) => {
  await setTimeout(count === 0 ? 1 : count, delay)
}

interface createFetcherProps {
  owner: string
  repo: string
  token: string
  delay: number
}
export const createFetcher = ({
  owner,
  repo,
  token,
  delay,
}: createFetcherProps) => {
  const octokit = new Octokit({ auth: token })

  /**
   * プロジェクトのすべてのプルリク情報を取得
   * @returns プロジェクトのすべてのプルリク情報の配列
   */
  const pullrequests = async () => {
    let pulls: ShapedGitHubPullRequest[] = []
    let page = 1
    while (true) {
      const ret = await octokit.rest.pulls.list({
        owner,
        repo,
        state: 'all',
        page,
        per_page: 100,
      })
      await wait({ count: ret.data.length, delay })
      if (ret.data.length === 0) break
      pulls = [...pulls, ...ret.data.map((pr) => shapeGitHubPullRequest(pr))]
      page++
    }
    return pulls
  }

  const commits = async (pullNumber: number) => {
    let allCommits: ShapedGitHubCommit[] = []
    let page = 1
    while (true) {
      const ret = await octokit.rest.pulls.listCommits({
        owner,
        repo,
        pull_number: pullNumber,
        page,
        per_page: 100,
      })
      await wait({ count: ret.data.length, delay })
      if (ret.data.length === 0) break
      allCommits = [
        ...allCommits,
        ...ret.data.map((commit) => shapeGitHubCommit(commit)),
      ]
      page++
    }
    return allCommits
  }

  const issueComments = async (pullNumber: number) => {
    const allComments: ShapedGitHubIssueComment[] = []
    let page = 1
    while (true) {
      const ret = await octokit.rest.issues.listComments({
        owner,
        repo,
        issue_number: pullNumber,
        page,
        per_page: 100,
      })
      await wait({ count: ret.data.length, delay })
      if (ret.data.length === 0) break
      allComments.push(
        ...ret.data.map((comment) => shapeGitHubIssueComment(comment)),
      )
      page++
    }
    return allComments
  }

  const reviewComments = async (pullNumber: number) => {
    let allComments: ShapedGitHubReviewComment[] = []
    let page = 1
    while (true) {
      const ret = await octokit.rest.pulls.listReviewComments({
        owner,
        repo,
        pull_number: pullNumber,
        page,
        per_page: 100,
      })
      await wait({ count: ret.data.length, delay })
      if (ret.data.length === 0) break
      allComments = [
        ...allComments,
        ...ret.data.map((comment) => shapeGitHubReviewComment(comment)),
      ]
      page++
    }
    return allComments
  }

  // すべてのコメントを統合してマージ/ソート
  const comments = async (pullNumber: number) => {
    const issue = await issueComments(pullNumber)
    const review = await reviewComments(pullNumber)

    const allComments = [...issue, ...review]
    allComments.sort(
      (a, b) => dayjs(a.created_at).unix() - dayjs(b.created_at).unix(),
    )
    return allComments
  }

  const reviews = async (pullNumber: number) => {
    let allReviews: ShapedGitHubReview[] = []
    let page = 1
    while (true) {
      const ret = await octokit.rest.pulls.listReviews({
        owner,
        repo,
        pull_number: pullNumber,
        page,
        per_page: 100,
      })
      await wait({ count: ret.data.length, delay })
      if (ret.data.length === 0) break
      allReviews = [
        ...allReviews,
        ...ret.data.map((review) => shapeGitHubReview(review)),
      ]
      page++
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
            { name: node.name, sha, committed_at: committedDate },
          ]
        }
      }

      hasNextPage = refs.pageInfo.hasNextPage
      cursor = refs.pageInfo.endCursor ?? null
    }

    return allTags
  }

  return { pullrequests, commits, comments, reviews, tags }
}
