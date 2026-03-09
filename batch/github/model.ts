import type { RestEndpointMethodTypes } from '@octokit/plugin-rest-endpoint-methods'

export type GitHubPullRequest =
  RestEndpointMethodTypes['pulls']['list']['response']['data'][0]
export type GitHubCommit =
  RestEndpointMethodTypes['pulls']['listCommits']['response']['data'][0]
export type GitHubReview =
  RestEndpointMethodTypes['pulls']['listReviews']['response']['data'][0]
export type GithubIssueComment =
  RestEndpointMethodTypes['issues']['listComments']['response']['data'][0]
export type GitHubReviewComment =
  RestEndpointMethodTypes['pulls']['listReviewComments']['response']['data'][0]
export type ShapedGitHubPullRequest = {
  id: GitHubPullRequest['id']
  organization: GitHubPullRequest['base']['repo']['owner']['login']
  repo: GitHubPullRequest['base']['repo']['name']
  number: GitHubPullRequest['number']
  state: 'open' | 'closed'
  title: GitHubPullRequest['title']
  body: string | null
  url: GitHubPullRequest['html_url']
  author: NonNullable<GitHubPullRequest['user']>['login'] | null
  assignees: string[]
  reviewers: { login: string; requestedAt: string | null }[]
  draft: boolean
  sourceBranch: GitHubPullRequest['head']['ref']
  targetBranch: GitHubPullRequest['base']['ref']
  createdAt: GitHubPullRequest['created_at']
  updatedAt: GitHubPullRequest['updated_at']
  mergedAt: GitHubPullRequest['merged_at'] | null
  closedAt: string | null
  mergeCommitSha: GitHubPullRequest['merge_commit_sha'] | null
  additions: number | null
  deletions: number | null
  changedFiles: number | null
  files: { path: string; additions: number; deletions: number }[]
}

export type ShapedGitHubCommit = {
  sha: GitHubCommit['sha']
  url: GitHubCommit['html_url']
  committer: NonNullable<GitHubCommit['author']>['login'] | null
  date: NonNullable<GitHubCommit['commit']['author']>['date'] | null
}

export type ShapedGitHubIssueComment = {
  id: GithubIssueComment['id']
  user: NonNullable<GithubIssueComment['user']>['login'] | null
  isBot: boolean
  url: GithubIssueComment['html_url']
  createdAt: GithubIssueComment['created_at']
}

export type ShapedGitHubReviewComment = {
  id: GitHubReviewComment['id']
  user: GitHubReviewComment['user']['login'] | null
  isBot: boolean
  url: GitHubReviewComment['html_url']
  createdAt: GitHubReviewComment['created_at']
}

export type ShapedGitHubReview = {
  id: GitHubReview['id']
  user: NonNullable<GitHubReview['user']>['login'] | null
  isBot: boolean
  state:
    | 'APPROVED'
    | 'CHANGES_REQUESTED'
    | 'COMMENTED'
    | 'DISMISSED'
    | 'PENDING'
  url: GitHubReview['html_url']
  submittedAt: NonNullable<GitHubReview['submitted_at']> | null
}

// タグ
export type ShapedGitHubTag = {
  name: string
  sha: string
  committedAt: string
}

// Timeline item (ローデータ保存用)
export type ShapedTimelineItem = {
  type: string
  createdAt: string
  actor?: string | null
  reviewer?: string | null
  environment?: string | null
}

// PR + 関連データを一括取得した結果
export type ShapedGitHubPullRequestWithDetails = {
  pr: ShapedGitHubPullRequest
  commits: ShapedGitHubCommit[]
  reviews: ShapedGitHubReview[]
  comments: (ShapedGitHubIssueComment | ShapedGitHubReviewComment)[]
  timelineItems: ShapedTimelineItem[]
  /** 制限を超えて追加取得が必要かどうか */
  needsMoreCommits: boolean
  needsMoreReviews: boolean
  needsMoreComments: boolean
  needsMoreReviewThreads: boolean
  needsMoreReviewThreadComments: boolean
  needsMoreTimelineItems: boolean
}
