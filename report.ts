import 'dotenv/config'
import dayjs from 'dayjs'
import { loader } from './src/loader'
import { aggregate } from './src/aggregator'

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

      const nullOrDate = (created_at?: Date | string) => {
        return created_at && dayjs(created_at).format('YYYY-MM-DD HH:mm')
      }

      // マージリクエスト1件
      console.log(
        [
          m.iid,
          m.target_branch,
          m.state,
          commits.length,
          aggregate.reviewComments(discussions).length,
          nullOrDate(aggregate.firstCommit(commits)?.created_at),
          nullOrDate(aggregate.firstDisucussion(discussions)?.created_at),
          dayjs(m.created_at).format('YYYY-MM-DD HH:mm'),
          m.merged_at && dayjs(m.merged_at).format('YYYY-MM-DD HH:mm'),
          ,
          m.author.username,
          m.title,
        ].join('\t')
      )
    })
}
main()
