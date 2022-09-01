import type { GitHubPullRequest } from '../model'
import { pipe, sortBy, last } from 'remeda'

export const leastUpdatedPullRequest = (pullrequests: GitHubPullRequest[]) =>
  pipe(
    pullrequests,
    sortBy((x) => x.updated_at),
    last()
  ) ?? null
