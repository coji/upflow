import type { RestEndpointMethodTypes } from '@octokit/plugin-rest-endpoint-methods'

export type GitHubPullRequest = RestEndpointMethodTypes['pulls']['list']['response']['data'][0]
export type GitHubCommit = RestEndpointMethodTypes['pulls']['listCommits']['response']['data'][0]
export type GitHubReview = RestEndpointMethodTypes['pulls']['listReviews']['response']['data'][0]
export type GitHubReviewComment = RestEndpointMethodTypes['pulls']['listReviewComments']['response']['data'][0]
export type GitHubUser = GitHubPullRequest['user']

export interface ShapedGitHubPullRequest {
  number: GitHubPullRequest['number']
  state: GitHubPullRequest['state']
  title: GitHubPullRequest['title']
  url: GitHubPullRequest['html_url']
  author: NonNullable<GitHubPullRequest['user']>['login'] | null
  targetBranch: GitHubPullRequest['base']['ref']
  repo: GitHubPullRequest['base']['repo']['name']
  createdAt: GitHubPullRequest['created_at']
  updatedAt: GitHubPullRequest['updated_at']
  mergedAt: GitHubPullRequest['merged_at'] | null
  mergeCommitSha: GitHubPullRequest['merge_commit_sha'] | null
}

export interface ShapedGitHubCommit {
  sha: GitHubCommit['sha']
  url: GitHubCommit['html_url']
  author: NonNullable<GitHubCommit['author']>['login'] | null
  date: NonNullable<GitHubCommit['commit']['author']>['date'] | null
}

export interface ShapedGitHubReviewComment {
  id: GitHubReviewComment['id']
  user: GitHubReviewComment['user']['login']
  url: GitHubReviewComment['html_url']
  createdAt: GitHubReviewComment['created_at']
}
