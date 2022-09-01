import type { GitLabDiscussion } from '../model'

/**
 * ディスカッションから、MRに対するレビューのみを抽出
 * @param discussions
 * @returns
 */
export const reviewComments = (discussions: GitLabDiscussion[]) =>
  discussions
    .filter(
      (d) =>
        d.notes &&
        d.notes.some(
          (note) => note.type === 'DiffNote' || note.type === 'DiscussionNote' // レビューコメントがあるもののみ
        )
    )
    .map((d) => d.notes?.filter((note) => note.type === 'DiffNote' || note.type === 'DiscussionNote') || [])
    .flat(1)
