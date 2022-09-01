import type { RestEndpointMethodTypes } from '@octokit/plugin-rest-endpoint-methods'

export type GitHubPullRequest = RestEndpointMethodTypes['pulls']['list']['response']['data'][0]
export type GitHubCommit = RestEndpointMethodTypes['pulls']['listCommits']['response']['data'][0]
export type GitHubReview = RestEndpointMethodTypes['pulls']['listReviews']['response']['data'][0]
export type GitHubReviewComment = RestEndpointMethodTypes['pulls']['listReviewComments']['response']['data'][0]
