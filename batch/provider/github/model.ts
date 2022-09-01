import type { RestEndpointMethodTypes } from '@octokit/plugin-rest-endpoint-methods'

export type PullRequest = RestEndpointMethodTypes['pulls']['list']['response']['data'][0]
export type Commit = RestEndpointMethodTypes['pulls']['listCommits']['response']['data'][0]
export type Review = RestEndpointMethodTypes['pulls']['listReviews']['response']['data'][0]
export type ReviewComment = RestEndpointMethodTypes['pulls']['listReviewComments']['response']['data'][0]
