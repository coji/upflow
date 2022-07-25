import type { Types } from '@gitbeaker/node'
import { releasedMergeRequests } from './releasedMergeRequests'
import { createLoader } from '../loader'

const loader = createLoader()

/**
 * リリースにマージされた日時を取得
 * @param targetHash
 * @param allMergeRequests
 * @returns [string|null] マージ日時
 */
export const findReleaseDate = async (allMergeRequests: Types.MergeRequestSchema[], targetHash?: string) => {
  let merged_at = null
  for (const m of releasedMergeRequests(allMergeRequests)) {
    const commits = await loader.commits(m.iid)
    if (commits.some((c: any) => c.id === targetHash)) {
      merged_at = m.merged_at
    }
  }
  return merged_at
}
