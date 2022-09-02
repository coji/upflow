import type { GitLabMergeRequest, GitLabCommit, GitLabDiscussion } from '../model'
import fs from 'fs'
import { globby } from 'globby'
import path from 'path'
import { createPathBuilder } from '~/batch/helper/path-builder'

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
  const commits = async (mergerequestIid: number) =>
    load<GitLabCommit[]>(pathBuilder.commitsJsonFilename(mergerequestIid))
  const discussions = async (mergerequestIid: number) =>
    load<GitLabDiscussion[]>(pathBuilder.discussionsJsonFilename(mergerequestIid))
  const mergerequests = async () => load<GitLabMergeRequest[]>('mergerequests.json')
  const releasedCommits = async () => {
    const commits: GitLabCommit[] = []
    const matches = await globby(pathBuilder.releaseCommitsGlob())
    for (const filename of matches) {
      const sha = pathBuilder.sha(filename)
      commits.push(await load<GitLabCommit>(pathBuilder.releaseCommitsJsonFilename(sha)))
    }
    return commits
  }
  const releasedCommitsBySha = async (sha: string) =>
    await load<GitLabCommit>(pathBuilder.releaseCommitsJsonFilename(sha))

  const releasedMergeRequests = (allMergeRequests: GitLabMergeRequest[]) =>
    allMergeRequests.filter((mr) => mr.target_branch === 'production' && mr.state === 'merged')

  const findReleaseDate = async (allMergeRequests: GitLabMergeRequest[], targetHash?: string) => {
    let merged_at = null
    for (const m of releasedMergeRequests(allMergeRequests)) {
      if ((await commits(m.iid)).some((c: any) => c.id === targetHash)) {
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
      mergerequests,
      releasedCommits,
      releasedCommitsBySha,
      findReleaseDate
    }
  }
}
