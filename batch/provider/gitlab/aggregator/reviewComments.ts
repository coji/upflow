import type { ShapedGitLabDiscussion } from '../model'

/**
 * ディスカッションから、MRに対するレビューのみを抽出
 * @param discussions
 * @returns
 */
export const reviewComments = (discussions: ShapedGitLabDiscussion[]) =>
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
