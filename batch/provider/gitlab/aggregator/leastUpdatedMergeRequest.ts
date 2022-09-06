import type { ShapedGitLabMergeRequest } from '../model'
import { pipe, sortBy, last } from 'remeda'

export const leastUpdatedMergeRequest = (mergerequests: ShapedGitLabMergeRequest[]) =>
  pipe(
    mergerequests,
    sortBy((x) => x.updatedAt),
    last()
  ) ?? null
