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
export type GitHubUser = GitHubPullRequest['user']

export type ShapedGitHubPullRequest = {
  id: GitHubPullRequest['id']
  organization: GitHubPullRequest['base']['repo']['owner']['login']
  repo: GitHubPullRequest['base']['repo']['name']
  number: GitHubPullRequest['number']
  state: GitHubPullRequest['state']
  title: GitHubPullRequest['title']
  url: GitHubPullRequest['html_url']
  author: NonNullable<GitHubPullRequest['user']>['login'] | null
  assignees: string[]
  reviewers: string[]
  draft: boolean
  source_branch: GitHubPullRequest['head']['ref']
  target_branch: GitHubPullRequest['base']['ref']
  created_at: GitHubPullRequest['created_at']
  updated_at: GitHubPullRequest['updated_at']
  merged_at: GitHubPullRequest['merged_at'] | null
  merge_commit_sha: GitHubPullRequest['merge_commit_sha'] | null
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
  url: GithubIssueComment['html_url']
  created_at: GithubIssueComment['created_at']
}

export type ShapedGitHubReviewComment = {
  id: GitHubReviewComment['id']
  user: GitHubReviewComment['user']['login'] | null
  url: GitHubReviewComment['html_url']
  created_at: GitHubReviewComment['created_at']
}

export type ShapedGitHubReview = {
  id: GitHubReview['id']
  user: NonNullable<GitHubReview['user']>['login'] | null
  state: GitHubReview['state']
  url: GitHubReview['html_url']
  submitted_at: NonNullable<GitHubReview['submitted_at']> | null
}

// タグ
export type ShapedGitHubTag = {
  name: string
  sha: string
  committed_at: string
}
