import type { Types } from '@gitbeaker/node'
/**
 * マージ済みプロダクションリリースMRの取得
 * @param allMergeRequests
 * @returns
 */
export const releasedMergeRequests = (allMergeRequests: Types.MergeRequestSchema[]) =>
  allMergeRequests.filter((mr) => mr.target_branch === 'production' && mr.state === 'merged')
