import { Types } from '@gitbeaker/node'
import { reviewComments } from './reviewCommits'
/**
 * 最初についたレビューコメントを抽出
 * @param discussions
 * @returns
 */
export const firstReviewComment = (discussions: Types.DiscussionSchema[]) => {
  const comments = reviewComments(discussions)
  if (comments.length === 0) return null
  return comments.reduce((a, b) => (a.created_at < b.created_at ? a : b))
}
