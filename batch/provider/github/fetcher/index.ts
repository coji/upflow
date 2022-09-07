import { Octokit } from 'octokit'
import type { GitHubPullRequest, GitHubCommit } from '../model'

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
    let pulls: GitHubPullRequest[] = []
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
      pulls = [...pulls, ...ret.data]
      page++
    } while (true)
    return pulls
  }

  const commits = async (pullNumber: number) => {
    let allCommits: GitHubCommit[] = []
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
      allCommits = [...allCommits, ...ret.data]
      page++
    } while (true)
    return allCommits
  }

  const firstReviewComment = async (pullNumber: number, excludeUser?: string) => {
    let page = 1
    do {
      const ret = await octokit.rest.pulls.listReviewComments({
        owner,
        repo,
        pull_number: pullNumber,
        page,
        per_page: 100
      })
      if (!ret.data[0]) return null // 見つからないので null
      page++

      // 除外ユーザを除いたレビューを一件取り出す
      const reviews = ret.data.filter((review) => review.user.login !== excludeUser)
      if (reviews.length > 0) return reviews[0]
    } while (true)
  }

  return { pullrequests, commits, firstReviewComment }
}
