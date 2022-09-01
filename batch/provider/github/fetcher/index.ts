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

  const firstCommit = async (pullNumber: number) => {
    const ret = await octokit.rest.pulls.listCommits({
      owner,
      repo,
      pull_number: pullNumber,
      page: 1,
      per_page: 1
    })
    let commit: GitHubCommit = ret.data[0]
    return commit
  }

  const firstReviewComment = async (pullNumber: number) => {
    const ret = await octokit.rest.pulls.listReviewComments({
      owner,
      repo,
      pull_number: pullNumber,
      page: 1,
      per_page: 1
    })
    const reviewComment: GitHubReviewComment = ret.data[0]
    if (!ret.data[0]) return
    return reviewComment
  }

  return { pullrequests, firstCommit, firstReviewComment }
}
