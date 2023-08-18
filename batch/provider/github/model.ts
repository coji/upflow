import type { RestEndpointMethodTypes } from '@octokit/plugin-rest-endpoint-methods'

export type GitHubPullRequest = RestEndpointMethodTypes['pulls']['list']['response']['data'][0]
export type GitHubCommit = RestEndpointMethodTypes['pulls']['listCommits']['response']['data'][0]
export type GitHubReview = RestEndpointMethodTypes['pulls']['listReviews']['response']['data'][0]
export type GithubIssueComment = RestEndpointMethodTypes['issues']['listComments']['response']['data'][0]
export type GitHubReviewComment = RestEndpointMethodTypes['pulls']['listReviewComments']['response']['data'][0]
export type GitHubUser = GitHubPullRequest['user']

export interface ShapedGitHubPullRequest {
  repo: GitHubPullRequest['base']['repo']['name']
  number: GitHubPullRequest['number']
  state: GitHubPullRequest['state']
  title: GitHubPullRequest['title']
  url: GitHubPullRequest['html_url']
  author: NonNullable<GitHubPullRequest['user']>['login'] | null
  sourceBranch: GitHubPullRequest['head']['ref']
  targetBranch: GitHubPullRequest['base']['ref']
  createdAt: GitHubPullRequest['created_at']
  updatedAt: GitHubPullRequest['updated_at']
  mergedAt: GitHubPullRequest['merged_at'] | null
  mergeCommitSha: GitHubPullRequest['merge_commit_sha'] | null
}

export interface ShapedGitHubCommit {
  sha: GitHubCommit['sha']
  url: GitHubCommit['html_url']
  committer: NonNullable<GitHubCommit['author']>['login'] | null
  date: NonNullable<GitHubCommit['commit']['author']>['date'] | null
}

export interface ShapedGitHubIssueComment {
  id: GithubIssueComment['id']
  user: NonNullable<GithubIssueComment['user']>['login'] | null
  url: GithubIssueComment['html_url']
  createdAt: GithubIssueComment['created_at']
}

export interface ShapedGitHubReviewComment {
  id: GitHubReviewComment['id']
  user: GitHubReviewComment['user']['login']
  url: GitHubReviewComment['html_url']
  createdAt: GitHubReviewComment['created_at']
}

export interface ShapedGitHubReview {
  id: GitHubReview['id']
  user: NonNullable<GitHubReview['user']>['login'] | null
  state: GitHubReview['state']
  url: GitHubReview['html_url']
  submittedAt: NonNullable<GitHubReview['submitted_at']> | null
}

// タグ
export interface ShapedGitHubTag {
  name: string
  sha: string
  committedAt: string
}
