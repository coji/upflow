import type { GitLabMergeRequest } from '../model'
import { pipe, sortBy, last } from 'remeda'

export const leastUpdatedMergeRequest = (mergerequests: GitLabMergeRequest[]) =>
  pipe(
    mergerequests,
    sortBy((x) => x.updated_at),
    last()
  ) ?? null
