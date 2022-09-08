import { createPathBuilder } from '~/batch/helper/path-builder'
import type {
  ShapedGitHubPullRequest,
  ShapedGitHubReviewComment,
  ShapedGitHubCommit,
  ShapedGitHubReview
} from '../model'
import fs from 'fs'
import path from 'path'

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
  const commits = async (number: number) => load<ShapedGitHubCommit[]>(pathBuilder.commitsJsonFilename(number))
  const discussions = async (number: number) =>
    load<ShapedGitHubReviewComment[]>(pathBuilder.discussionsJsonFilename(number))
  const reviews = async (number: number) => load<ShapedGitHubReview[]>(pathBuilder.reviewJsonFilename(number))
  const pullrequests = async () => load<ShapedGitHubPullRequest[]>('pullrequests.json')

  return {
    load,
    save,
    path: pathBuilder,
    loader: {
      commits,
      discussions,
      reviews,
      pullrequests
    }
  }
}
