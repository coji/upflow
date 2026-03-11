import type {
  ShapedGitHubCommit,
  ShapedGitHubReview,
  ShapedGitHubReviewComment,
  ShapedGitHubTag,
  ShapedTimelineItem,
} from './model'

/** リポジトリID → 更新PR番号セット。undefined なら全件処理 */
export type UpdatedPrNumbersMap = Map<string, Set<number>>

/** PR 解析に必要な I/O を抽象化した型 */
export interface PullRequestLoaders {
  commits: (number: number) => Promise<ShapedGitHubCommit[]>
  reviews: (number: number) => Promise<ShapedGitHubReview[]>
  discussions: (number: number) => Promise<ShapedGitHubReviewComment[]>
  tags: () => Promise<ShapedGitHubTag[]>
  timelineItems: (number: number) => Promise<ShapedTimelineItem[]>
}

/** buildPullRequests が返すレビュー情報 */
export interface AnalyzedReview {
  id: string
  pullRequestNumber: number
  repositoryId: string
  reviewer: string
  state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED'
  submittedAt: string
  url: string
}

/** buildPullRequests が返すレビュアー情報 */
export interface AnalyzedReviewer {
  pullRequestNumber: number
  repositoryId: string
  reviewers: { login: string; requestedAt: string | null }[]
}

/** buildPullRequests が返すレビューレスポンス情報 */
export interface AnalyzedReviewResponse {
  repo: string
  number: string
  author: string
  createdAt: string
  responseTime: number
}
