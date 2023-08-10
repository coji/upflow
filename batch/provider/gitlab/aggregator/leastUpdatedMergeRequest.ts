import { last, pipe, sortBy } from 'remeda'
import type { ShapedGitLabMergeRequest } from '../model'

export const leastUpdatedMergeRequest = (mergerequests: ShapedGitLabMergeRequest[]) =>
  pipe(
    mergerequests,
    sortBy((x) => x.updatedAt),
    last(),
  ) ?? null
