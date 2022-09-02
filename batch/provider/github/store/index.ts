import { createPathBuilder } from '~/batch/helper/path-builder'
import type { GitHubPullRequest, GitHubReviewComment, GitHubCommit } from '../model'
import fs from 'fs'
import path from 'path'
import { globby } from 'globby'

interface createStoreProps {
  companyId: string
  repositoryId: string
}
export const createStore = ({ companyId, repositoryId }: createStoreProps) => {
  const pathBuilder = createPathBuilder({ companyId, repositoryId })

  /**
   * JSON ファイルの読み込み
   *
   * @param filename
   */
  const load = <T>(filename: string) => JSON.parse(fs.readFileSync(pathBuilder.jsonPath(filename)).toString()) as T

  /**
   * JSON ファイルの保存
   *
   * @param filename
   * @param content
   */
  const save = (filename: string, content: unknown) => {
    // ディレクトリがなければ作成
    fs.mkdirSync(path.dirname(pathBuilder.jsonPath(filename)), { recursive: true })
    fs.writeFileSync(pathBuilder.jsonPath(filename), JSON.stringify(content, null, 2))
  }

  // loaders
  const commits = async (number: number) => load<GitHubCommit[]>(pathBuilder.commitsJsonFilename(number))
  const discussions = async (number: number) => load<GitHubReviewComment>(pathBuilder.discussionsJsonFilename(number))
  const pullrequests = async () => load<GitHubPullRequest[]>('pullrequests.json')
  const releasedCommits = async () => {
    const commits: GitHubCommit[] = []
    const matches = await globby(pathBuilder.releaseCommitsGlob())
    for (const filename of matches) {
      const sha = pathBuilder.sha(filename)
      commits.push(await load<GitHubCommit>(pathBuilder.releaseCommitsJsonFilename(sha)))
    }
    return commits
  }
  const releasedCommitsBySha = async (sha: string) =>
    await load<GitHubCommit>(pathBuilder.releaseCommitsJsonFilename(sha))

  const releasedPullRequests = (allPullRequests: GitHubPullRequest[]) =>
    allPullRequests.filter((pr) => pr.state === 'closed')

  const findReleaseDate = async (allPullRequests: GitHubPullRequest[], targetHash?: string) => {
    let merged_at = null
    for (const m of releasedPullRequests(allPullRequests)) {
      if ((await commits(m.number)).some((c) => c.sha === targetHash)) {
        merged_at = m.merged_at
      }
    }
    return merged_at
  }

  return {
    load,
    save,
    path: pathBuilder,
    loader: {
      commits,
      discussions,
      pullrequests,
      releasedCommits,
      releasedCommitsBySha,
      findReleaseDate
    }
  }
}
