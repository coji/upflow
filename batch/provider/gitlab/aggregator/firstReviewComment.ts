import type { ShapedGitLabDiscussionNote } from '../model'

/**
 * 最初についたレビューコメントを抽出
 * @param discussions
 * @param excludeUsername 除外するユーザ名 (MR)
 * @returns
 */
export const firstReviewComment = (discussions: ShapedGitLabDiscussionNote[], excludeUsername: string) => {
  const comments = discussions.filter(
    (review) => review.author !== excludeUsername && (review.type === 'DiffNote' || review.type === 'DiscussionNote')
  )
  if (comments.length === 0) return null
  return comments.reduce((a, b) => (a.createdAt < b.createdAt ? a : b))
}
