import { Octokit } from 'octokit'
import type { GitHubPullRequest, GitHubCommit, GitHubReviewComment } from '../model'

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

  const reviewComments = async (pullNumber: number) => {
    let allComments: GitHubReviewComment[] = []
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
      allComments = [...allComments, ...ret.data]
      page++
    } while (true)
    return allComments
  }

  return { pullrequests, commits, reviewComments }
}
