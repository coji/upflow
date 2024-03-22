import fs from 'node:fs/promises'
import path from 'node:path'
import { createPathBuilder } from '~/batch/helper/path-builder'
import type {
  ShapedGitHubCommit,
  ShapedGitHubPullRequest,
  ShapedGitHubReview,
  ShapedGitHubReviewComment,
  ShapedGitHubTag,
} from '../model'

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
  const load = async <T>(filename: string) =>
    JSON.parse(await fs.readFile(pathBuilder.jsonPath(filename), 'utf-8')) as T

  /**
   * JSON ファイルの保存
   *
   * @param filename
   * @param content
   */
  const save = async (filename: string, content: unknown) => {
    // ディレクトリがなければ作成
    await fs.mkdir(path.dirname(pathBuilder.jsonPath(filename)), {
      recursive: true,
    })
    await fs.writeFile(
      pathBuilder.jsonPath(filename),
      JSON.stringify(content, null, 2),
    )
  }

  // loaders
  const commits = async (number: number) =>
    load<ShapedGitHubCommit[]>(pathBuilder.commitsJsonFilename(number))
  const discussions = async (number: number) =>
    load<ShapedGitHubReviewComment[]>(
      pathBuilder.discussionsJsonFilename(number),
    )
  const reviews = async (number: number) =>
    load<ShapedGitHubReview[]>(pathBuilder.reviewJsonFilename(number))
  const pullrequests = async () =>
    load<ShapedGitHubPullRequest[]>('pullrequests.json')
  const tags = async () => load<ShapedGitHubTag[]>('tags.json')

  return {
    load,
    save,
    path: pathBuilder,
    loader: {
      commits,
      discussions,
      reviews,
      pullrequests,
      tags,
    },
  }
}
