import type { ShapedGitLabMergeRequest, ShapedGitLabCommit, ShapedGitLabDiscussionNote } from '../model'
import fs from 'fs'
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
    load<ShapedGitLabDiscussionNote[]>(pathBuilder.discussionsJsonFilename(mergerequestIid))

  const mergerequests = async () => load<ShapedGitLabMergeRequest[]>('mergerequests.json')

  return {
    load,
    save,
    path: pathBuilder,
    loader: {
      commits,
      discussions,
      mergerequests
    }
  }
}
