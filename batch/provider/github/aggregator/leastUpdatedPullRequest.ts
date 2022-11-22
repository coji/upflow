import type { ShapedGitHubPullRequest } from '../model'
import { pipe, sortBy, last } from 'remeda'

export const leastUpdatedPullRequest = (pullrequests: ShapedGitHubPullRequest[]) =>
  pipe(
    pullrequests,
    sortBy((x) => x.updatedAt),
    last(),
  ) ?? null
