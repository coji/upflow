import type {
  ShapedGitHubCommit,
  ShapedGitHubReview,
  ShapedGitHubReviewComment,
  ShapedGitHubTag,
  ShapedTimelineItem,
} from './model'

/** PR 解析に必要な I/O を抽象化した型 */
export interface PullRequestLoaders {
  commits: (number: number) => Promise<ShapedGitHubCommit[]>
  reviews: (number: number) => Promise<ShapedGitHubReview[]>
  discussions: (number: number) => Promise<ShapedGitHubReviewComment[]>
  tags: () => Promise<ShapedGitHubTag[]>
  timelineItems: (number: number) => Promise<ShapedTimelineItem[]>
}
