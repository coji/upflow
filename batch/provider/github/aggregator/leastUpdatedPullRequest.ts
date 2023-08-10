import { last, pipe, sortBy } from 'remeda'
import type { ShapedGitHubPullRequest } from '../model'

export const leastUpdatedPullRequest = (pullrequests: ShapedGitHubPullRequest[]) =>
  pipe(
    pullrequests,
    sortBy((x) => x.updatedAt),
    last(),
  ) ?? null
