import type { Types } from '@gitbeaker/node'

export const leastUpdatedMergeRequest = (mergerequests: Types.MergeRequestSchema[]) =>
  mergerequests.length > 0 ? mergerequests.reduce((a, b) => (a.updated_at > b.updated_at ? a : b)) : null
