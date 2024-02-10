import {
  ShapedGitHubCommit,
  ShapedGitHubIssueComment,
  ShapedGitHubPullRequest,
  ShapedGitHubReview,
  ShapedGitHubTag,
} from '../provider/github/model'
export interface DB {
  pull_requests: {
    repo_id: string
    assignees: string // JSON (array of strings)
    reviewers: string // JSON (array of strings)
  } & Omit<ShapedGitHubPullRequest, 'assignees' | 'reviewers'>

  tags: {
    repo_id: string
  } & ShapedGitHubTag

  commits: {
    repo_id: string
    pull_request_id: number
  } & ShapedGitHubCommit

  issue_comments: {
    repo_id: string
    pull_request_id: number
  } & ShapedGitHubIssueComment

  reviews: {
    repo_id: string
    pull_request_id: number
  } & ShapedGitHubReview
}
