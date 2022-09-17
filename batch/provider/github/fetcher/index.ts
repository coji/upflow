import { Octokit } from 'octokit'
import type {
  ShapedGitHubPullRequest,
  ShapedGitHubCommit,
  ShapedGitHubReviewComment,
  ShapedGitHubReview
} from '../model'
import { shapeGitHubPullRequest, shapeGitHubCommit, shapeGitHubReview, shapeGitHubReviewComment } from '../shaper'
import dayjs from '~/app/libs/dayjs'

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
        per_page: 100
      })
      if (ret.data.length === 0) break
      pulls = [
        ...pulls,
        ...ret.data
          .filter((pr) => dayjs(pr.updated_at) > dayjs().add(-90, 'days')) // 90日以上前のは除外
          .map((pr) => shapeGitHubPullRequest(pr))
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
        per_page: 100
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
        per_page: 100
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
        per_page: 100
      })
      if (ret.data.length === 0) break
      allReviews = [...allReviews, ...ret.data.map((review) => shapeGitHubReview(review))]
      page++
    } while (true)
    return allReviews
  }

  return { pullrequests, commits, reviewComments, reviews }
}
