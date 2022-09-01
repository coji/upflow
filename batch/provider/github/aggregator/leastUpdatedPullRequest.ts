import type { PullRequest } from '../model'
import { pipe, sortBy, last } from 'remeda'

export const leastUpdatedPullRequest = (pullrequests: PullRequest[]) =>
  pipe(
    pullrequests,
    sortBy((x) => x.updated_at),
    last()
  ) ?? null
