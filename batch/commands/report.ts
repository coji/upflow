import type { Types } from '@gitbeaker/node'
import dayjs from 'dayjs'
import { createLoader } from '../loader'
import { createAggregator } from '../aggregator'
import os from 'os'

const nullOrDate = (dateStr?: Date | string | null) => {
  return dateStr && dayjs(dateStr).format('YYYY-MM-DD HH:mm')
}

export async function reportCommand() {
  // ヘッダ
  console.log(
    [
      'id',
      'target_branch',
      'state',
      'コミット数',
      'コメント数',
      '初回コミット日時',
      'MR作成日時',
      '初回レビュー日時',
      'マージ日時',
      'リリース日時',
      'リリースにコミット済',
      'MR作成者',
      'MRタイトル'
    ].join('\t')
  )

  const loader = createLoader()
  const aggregator = createAggregator()
  const mr = await loader.mergerequests()

  for (const m of mr.filter((m) => m.state !== 'closed' && m.target_branch !== 'production')) {
    // close じゃない & mainブランチターゲットのみ
    const commits = await loader.commits(m.iid).catch(() => [])
    const discussions = await loader.discussions(m.iid).catch(() => [])
    // リリースされたコミットにMR マージコミットが含まれるかどうか
    const releasedCommit =
      m.merge_commit_sha !== undefined && m.merge_commit_sha !== null && (await loader.releasedCommitsBySha(m.merge_commit_sha).catch(() => false))

    // マージリクエスト1件
    console.log(
      [
        m.iid,
        m.target_branch,
        m.state,
        commits.length || null,
        aggregator.reviewComments(discussions).length || null,
        nullOrDate(aggregator.firstCommit(commits)?.created_at),
        nullOrDate(m.created_at),
        nullOrDate(aggregator.firstReviewComment(discussions, (m.author as Types.UserSchema).username)?.created_at),
        nullOrDate(m.merged_at),
        nullOrDate(await aggregator.findReleaseDate(mr, m.merge_commit_sha)), // リリース日時 = production ブランチ対象MRに含まれる commits を MR merge_commit_sha で探してきてMRを特定し、そこの merged_at
        releasedCommit !== false, // リリースされたコミットにMRマージコミットが含まれている？
        m.author.username,
        m.title
      ].join('\t')
    )
  }
}
