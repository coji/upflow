import 'dotenv/config'
import dayjs from 'dayjs'
import { createLoader } from './src/loader'
import { createAggregator } from './src/aggregator'

const nullOrDate = (dateStr?: Date | string | null) => {
  return dateStr && dayjs(dateStr).format('YYYY-MM-DD HH:mm')
}

async function main() {
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
      'MRタイトル',
    ].join('\t')
  )

  const loader = createLoader()
  const aggregator = createAggregator()
  const releasedCommits = await loader.releasedCommits()
  const mr = await loader.mergerequests()

  mr.filter((m) => m.state !== 'closed' && m.target_branch === 'main') // close じゃない & mainブランチターゲットのみ
    .forEach(async (m) => {
      const commits = await loader.commits(m.iid).catch(() => [])
      const discussions = await loader.discussions(m.iid).catch(() => [])

      // マージリクエスト1件
      console.log(
        [
          m.iid,
          m.target_branch,
          m.state,
          commits.length || null,
          aggregator.discussionComments(discussions).length || null,
          nullOrDate(aggregator.firstCommit(commits)?.created_at),
          nullOrDate(m.created_at),
          nullOrDate(aggregator.firstReviewComment(discussions)?.created_at),
          nullOrDate(m.merged_at),
          nullOrDate(await aggregator.findReleaseDate(mr, m.merge_commit_sha)), // リリース日時 = production ブランチ対象MRに含まれる commits を MR merge_commit_sha で探してきてMRを特定し、そこの merged_at
          aggregator.isCommitIncluded(releasedCommits, m.merge_commit_sha),
          m.author.username,
          m.title,
        ].join('\t')
      )
    })
}
main()
