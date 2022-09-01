import type { Types } from '@gitbeaker/node'
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
  const commits = async (mergerequestIid: number) => load<Types.CommitSchema[]>(pathBuilder.commitsJsonFilename(mergerequestIid))
  const discussions = async (mergerequestIid: number) => load<Types.DiscussionSchema[]>(pathBuilder.discussionsJsonFilename(mergerequestIid))
  const mergerequests = async () => load<Types.MergeRequestSchema[]>('mergerequests.json')
  const releasedCommits = async () => {
    const commits: Types.CommitSchema[] = []
    const matches = await globby(pathBuilder.releaseCommitsGlob())
    for (const filename of matches) {
      const sha = pathBuilder.sha(filename)
      commits.push(await load<Types.CommitSchema>(pathBuilder.releaseCommitsJsonFilename(sha)))
    }
    return commits
  }
  const releasedCommitsBySha = async (sha: string) => await load<Types.CommitSchema>(pathBuilder.releaseCommitsJsonFilename(sha))

  const releasedMergeRequests = (allMergeRequests: Types.MergeRequestSchema[]) =>
    allMergeRequests.filter((mr) => mr.target_branch === 'production' && mr.state === 'merged')

  const findReleaseDate = async (allMergeRequests: Types.MergeRequestSchema[], targetHash?: string) => {
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
