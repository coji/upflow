import 'dotenv/config'
import dayjs from 'dayjs'
import { loader } from './src/loader'
import { aggregate } from './src/aggregator'

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
      'commits',
      'review_comments',
      'first_commited_at',
      'mergerequest_created_at',
      'first_reviewed_at',
      'merged_at',
      'released_at',
      'author',
      'title',
    ].join('\t')
  )

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
          aggregate.reviewComments(discussions).length || null,
          nullOrDate(aggregate.firstCommit(commits)?.created_at),
          nullOrDate(m.created_at),
          nullOrDate(aggregate.firstDisucussion(discussions)?.created_at),
          nullOrDate(m.merged_at),
          nullOrDate(await aggregate.findReleaseDate(mr, m.merge_commit_sha)), // リリース日時 = production ブランチ対象MRに含まれる commits を MR merge_commit_sha で探してきてMRを特定し、そこの merged_at
          m.author.username,
          m.title,
        ].join('\t')
      )
    })
}
main()
