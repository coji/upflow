import { Types } from '@gitbeaker/node'
import dayjs from 'dayjs'

export const aggregate = {
  firstCommit: (commits: Types.CommitSchema[]) =>
    commits.length
      ? commits.reduce((a, b) => (a.created_at < b.created_at ? a : b)) // 一番過去のもの1件を抽出
      : null,
  reviewComments: (discussions: Types.DiscussionSchema[]) =>
    discussions.filter(
      (d) => d.notes && d.notes.some((note) => note.type === 'DiffNote') // レビューコメントがあるもののみ
    ),
  firstDisucussion: (discussions: Types.DiscussionSchema[]) => {
    const firstDiffNotes = discussions
      .filter(
        (d) => d.notes && d.notes.some((note) => note.type === 'DiffNote') // レビューコメントがあるもののみ
      )
      .map(
        (d) => d.notes!.reduce((a, b) => (a.created_at < b.created_at ? a : b)) // 最初のレビューコメントを抽出
      )
    if (!firstDiffNotes || firstDiffNotes.length === 0) return null
    return firstDiffNotes.reduce(
      (a, b) => (a.created_at < b.created_at ? a : b) // 最初のレビューコメントを抽出
    )
  },
}
