import type { Types } from '@gitbeaker/node'
import dayjs from 'dayjs'
import { createLoader } from '../loader'
import { createAggregator } from '../aggregator'
import got from 'got'

const nullOrDate = (dateStr?: Date | string | null) => {
  return dateStr && dayjs(dateStr).format()
}

const API_URL = process.env.NODE_ENV === 'production' ? 'http://localhost:8080/api/mergerequests/upsert' : 'http://localhost:3000/api/mergerequests/upsert'

export async function upsertCommand() {
  const loader = createLoader()
  const aggregator = createAggregator()
  // const releasedCommits = await loader.releasedCommits()
  const mr = await loader.mergerequests()

  for (const m of mr.filter((m) => m.state !== 'closed' && m.target_branch !== 'production')) {
    // close じゃない & mainブランチターゲットのみ
    const commits = await loader.commits(m.iid).catch(() => [])
    const discussions = await loader.discussions(m.iid).catch(() => [])
    // リリースされたコミットにMR マージコミットが含まれるかどうか
    const releasedCommit =
      m.merge_commit_sha !== undefined && m.merge_commit_sha !== null && (await loader.releasedCommitsBySha(m.merge_commit_sha).catch(() => false))

    const item = {
      id: String(m.iid),
      target_branch: m.target_branch,
      state: m.state,
      num_of_commits: commits.length || null,
      num_of_comments: aggregator.reviewComments(discussions).length || null,
      first_commited_at: nullOrDate(aggregator.firstCommit(commits)?.created_at),
      mergerequest_created_at: nullOrDate(m.created_at),
      first_reviewd_at: nullOrDate(aggregator.firstReviewComment(discussions, (m.author as Types.UserSchema).username)?.created_at),
      merged_at: nullOrDate(m.merged_at),
      released_at: nullOrDate(await aggregator.findReleaseDate(mr, m.merge_commit_sha)), // リリース日時 = production ブランチ対象MRに含まれる commits を MR merge_commit_sha で探してきてMRを特定し、そこの merged_at
      is_release_committed: releasedCommit !== false,
      author: m.author.username,
      title: m.title
    }

    await got.post(API_URL, { json: { item } })
    console.log(m.iid)
  }
}
