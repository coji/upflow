import fs from 'node:fs/promises'
import path from 'node:path'
import { createPathBuilder } from '~/batch/helper/path-builder'
import type {
  ShapedGitHubCommit,
  ShapedGitHubPullRequest,
  ShapedGitHubReview,
  ShapedGitHubReviewComment,
  ShapedGitHubTag,
} from './model'

interface createStoreProps {
  organizationId: string
  repositoryId: string
}
export const createStore = ({
  organizationId,
  repositoryId,
}: createStoreProps) => {
  const pathBuilder = createPathBuilder({ organizationId, repositoryId })

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

  // メモ化キャッシュ（PR番号 → Promise）で同一ファイルの重複読み込みを防止
  const commitsCache = new Map<number, Promise<ShapedGitHubCommit[]>>()
  const discussionsCache = new Map<
    number,
    Promise<ShapedGitHubReviewComment[]>
  >()
  const reviewsCache = new Map<number, Promise<ShapedGitHubReview[]>>()

  // loaders
  const commits = (number: number) => {
    let cached = commitsCache.get(number)
    if (!cached) {
      cached = load<ShapedGitHubCommit[]>(
        pathBuilder.commitsJsonFilename(number),
      )
      commitsCache.set(number, cached)
    }
    return cached
  }
  const discussions = (number: number) => {
    let cached = discussionsCache.get(number)
    if (!cached) {
      cached = load<ShapedGitHubReviewComment[]>(
        pathBuilder.discussionsJsonFilename(number),
      )
      discussionsCache.set(number, cached)
    }
    return cached
  }
  const reviews = (number: number) => {
    let cached = reviewsCache.get(number)
    if (!cached) {
      cached = load<ShapedGitHubReview[]>(
        pathBuilder.reviewJsonFilename(number),
      )
      reviewsCache.set(number, cached)
    }
    return cached
  }
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
