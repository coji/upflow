import type { ShapedGitLabDiscussion } from '../model'
import { reviewComments } from './reviewComments'

/**
 * 最初についたレビューコメントを抽出
 * @param discussions
 * @param excludeUsername 除外するユーザ名 (MR)
 * @returns
 */
export const firstReviewComment = (discussions: ShapedGitLabDiscussion[], excludeUsername: string) => {
  const comments = reviewComments(discussions).filter((review) => review.author !== excludeUsername)
  if (comments.length === 0) return null
  return comments.reduce((a, b) => (a.createdAt < b.createdAt ? a : b))
}
