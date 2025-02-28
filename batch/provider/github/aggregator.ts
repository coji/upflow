import { last, pipe, sortBy } from 'remeda'
import type { ShapedGitHubPullRequest } from './model'

export const createAggregator = () => {
  return {
    leastUpdatedPullRequest,
  }
}

export const leastUpdatedPullRequest = (
  pullrequests: ShapedGitHubPullRequest[],
) =>
  pipe(
    pullrequests,
    sortBy((x) => x.updated_at),
    last(),
  ) ?? null
