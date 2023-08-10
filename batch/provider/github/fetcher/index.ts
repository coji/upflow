import { Octokit } from 'octokit'
import dayjs from '~/app/libs/dayjs'
import type {
  ShapedGitHubCommit,
  ShapedGitHubPullRequest,
  ShapedGitHubReview,
  ShapedGitHubReviewComment,
  ShapedGitHubTag,
} from '../model'
import { shapeGitHubCommit, shapeGitHubPullRequest, shapeGitHubReview, shapeGitHubReviewComment } from '../shaper'

interface createFetcherProps {
  owner: string
  repo: string
  token: string
}
export const createFetcher = ({ owner, repo, token }: createFetcherProps) => {
  const octokit = new Octokit({ auth: token })

  /**
   * プロジェクトのすべてのプルリク情報を取得
   * @returns プロジェクトのすべてのプルリク情報の配列
   */
  const pullrequests = async () => {
    let pulls: ShapedGitHubPullRequest[] = []
    let page = 1
    do {
      const ret = await octokit.rest.pulls.list({
        owner,
        repo,
        state: 'all',
        page,
        per_page: 100,
      })
      if (ret.data.filter((pr) => dayjs(pr.updated_at) > dayjs().utc().add(-90, 'days')).length === 0) break
      pulls = [
        ...pulls,
        ...ret.data
          .filter((pr) => dayjs(pr.updated_at) > dayjs().utc().add(-90, 'days')) // 90日以上前のは除外
          .map((pr) => shapeGitHubPullRequest(pr)),
      ]
      page++
    } while (true)
    return pulls
  }

  const commits = async (pullNumber: number) => {
    let allCommits: ShapedGitHubCommit[] = []
    let page = 1
    do {
      const ret = await octokit.rest.pulls.listCommits({
        owner,
        repo,
        pull_number: pullNumber,
        page,
        per_page: 100,
      })
      if (ret.data.length === 0) break
      allCommits = [...allCommits, ...ret.data.map((commit) => shapeGitHubCommit(commit))]
      page++
    } while (true)
    return allCommits
  }

  const reviewComments = async (pullNumber: number) => {
    let allComments: ShapedGitHubReviewComment[] = []
    let page = 1
    do {
      const ret = await octokit.rest.pulls.listReviewComments({
        owner,
        repo,
        pull_number: pullNumber,
        page,
        per_page: 100,
      })
      if (ret.data.length === 0) break
      allComments = [...allComments, ...ret.data.map((comment) => shapeGitHubReviewComment(comment))]
      page++
    } while (true)
    return allComments
  }

  const reviews = async (pullNumber: number) => {
    let allReviews: ShapedGitHubReview[] = []
    let page = 1
    do {
      const ret = await octokit.rest.pulls.listReviews({
        owner,
        repo,
        pull_number: pullNumber,
        page,
        per_page: 100,
      })
      if (ret.data.length === 0) break
      allReviews = [...allReviews, ...ret.data.map((review) => shapeGitHubReview(review))]
      page++
    } while (true)
    return allReviews
  }

  type PickPartial<T, K extends keyof T, G extends Exclude<keyof T, K>> = Required<Pick<T, K>> & Partial<Pick<T, G>>

  const tags = async () => {
    let tags: PickPartial<ShapedGitHubTag, 'name' | 'sha', 'committedAt'>[] = []
    let page = 1
    // タグの一覧を取得
    while (true) {
      const ret = await octokit.rest.repos.listTags({ owner, repo, page, per_page: 100 })
      if (ret.data.length === 0) break
      tags = [...tags, ...ret.data.map((tag) => ({ name: tag.name, sha: tag.commit.sha }))]
      page++
    }

    // タグのコミット日時を補完
    for (const tag of tags) {
      const tagCommit = await octokit.rest.repos.getCommit({ owner, repo, ref: tag.sha })
      tag.committedAt = tagCommit.data.commit.committer?.date
    }
    return tags.filter((tag) => !!tag.committedAt) as ShapedGitHubTag[] // コミット日時がないものは除外 (通常ないけど)
  }

  return { pullrequests, commits, reviewComments, reviews, tags }
}
