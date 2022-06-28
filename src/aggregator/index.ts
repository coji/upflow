import { Types } from '@gitbeaker/node'
import { loader } from '../loader'

const firstCommit = (commits: Types.CommitSchema[]) =>
  commits.length
    ? commits.reduce((a, b) => (a.created_at < b.created_at ? a : b)) // 一番過去のもの1件を抽出
    : null

const reviewComments = (discussions: Types.DiscussionSchema[]) =>
  discussions.filter(
    (d) => d.notes && d.notes.some((note) => note.type === 'DiffNote') // レビューコメントがあるもののみ
  )

const firstDisucussion = (discussions: Types.DiscussionSchema[]) => {
  const firstDiffNotes = reviewComments(discussions).map(
    (d) => d.notes!.reduce((a, b) => (a.created_at < b.created_at ? a : b)) // コミットから最初のレビューコメントリストを抽出
  )
  if (!firstDiffNotes || firstDiffNotes.length === 0) return null
  return firstDiffNotes.reduce(
    (a, b) => (a.created_at < b.created_at ? a : b) // 最初のレビューコメントを抽出
  )
}

/**
 * マージ済みプロダクションリリースMRの取得
 * @param allMergeRequests
 * @returns
 */
const releasedMergeRequests = (allMergeRequests: Types.MergeRequestSchema[]) =>
  allMergeRequests.filter(
    (mr) => mr.target_branch === 'production' && mr.state === 'merged'
  )

/**
 * リリースにマージされた日時を取得
 * @param targetHash
 * @param allMergeRequests
 * @returns [string|null] マージ日時
 */
const findReleaseDate = async (
  allMergeRequests: Types.MergeRequestSchema[],
  targetHash?: string
) => {
  let merged_at = null
  for (const m of releasedMergeRequests(allMergeRequests)) {
    const commits = await loader.commits(m.iid)
    if (commits.some((c) => c.id === targetHash)) {
      merged_at = m.merged_at
    }
  }
  return merged_at
}

export const aggregate = {
  firstCommit,
  reviewComments,
  firstDisucussion,
  releasedMergeRequests,
  findReleaseDate,
}
