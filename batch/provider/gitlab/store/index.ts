import type { ShapedGitLabMergeRequest, ShapedGitLabCommit, ShapedGitLabDiscussion } from '../model'
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
    load<ShapedGitLabCommit[]>(pathBuilder.commitsJsonFilename(mergerequestIid))
  const discussions = async (mergerequestIid: number) =>
    load<ShapedGitLabDiscussion[]>(pathBuilder.discussionsJsonFilename(mergerequestIid))

  const mergerequests = async () => load<ShapedGitLabMergeRequest[]>('mergerequests.json')

  const releasedCommits = async () => {
    const commits: ShapedGitLabCommit[] = []
    const matches = await globby(pathBuilder.releaseCommitsGlob())
    for (const filename of matches) {
      const sha = pathBuilder.sha(filename)
      commits.push(await load<ShapedGitLabCommit>(pathBuilder.releaseCommitsJsonFilename(sha)))
    }
    return commits
  }
  const releasedCommitsBySha = async (sha: string | null) =>
    sha ? await load<ShapedGitLabCommit>(pathBuilder.releaseCommitsJsonFilename(sha)) : null

  const releasedMergeRequests = (allMergeRequests: ShapedGitLabMergeRequest[]) =>
    allMergeRequests.filter((mr) => mr.targetBranch === 'production' && mr.state === 'merged')

  const findReleaseDate = async (allMergeRequests: ShapedGitLabMergeRequest[], targetHash: string | null) => {
    let mergedAt = null
    for (const m of releasedMergeRequests(allMergeRequests)) {
      const testCommits = await commits(m.iid)
      if (testCommits.some((c) => c.sha === targetHash)) {
        mergedAt = m.mergedAt
      }
    }
    return mergedAt
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
