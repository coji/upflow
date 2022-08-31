import type { Types } from '@gitbeaker/node'
import { pipe, sortBy, last } from 'remeda'

export const leastUpdatedMergeRequest = (mergerequests: Types.MergeRequestSchema[]) =>
  pipe(
    mergerequests,
    sortBy((x) => x.updated_at),
    last()
  ) ?? null
