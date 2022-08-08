import type { Types } from '@gitbeaker/node'
import dayjs from 'dayjs'
import got from 'got'
import invariant from 'tiny-invariant'
import { loadConfig, allConfigs } from '../config'
import { createStore } from '../store'
import { createAggregator } from '../aggregator'
import type { MergeRequest } from '@prisma/client'

const nullOrDate = (dateStr?: Date | string | null) => {
  return dateStr ? dayjs(dateStr).format() : null
}

const API_URL = process.env.NODE_ENV === 'production' ? 'http://localhost:8080/api/mergerequests/upsert' : 'http://localhost:3000/api/mergerequests/upsert'

interface UpsertCommandProps {
  companyId?: string
}
export async function upsertCommand({ companyId }: UpsertCommandProps) {
  if (!companyId) {
    console.log('config should specified')
    console.log((await allConfigs()).map((c) => `${c.companyName}\t${c.companyId}`).join('\n'))
    return
  }
  const config = await loadConfig(companyId)
  invariant(config, `config not found: ${companyId}`)

  for (const repository of config.repositories) {
    const store = createStore({
      companyId: config.companyId,
      repositoryId: repository.id
    })
    const aggregator = createAggregator()
    // const releasedCommits = await loader.releasedCommits()
    const mr = await store.loader.mergerequests()

    for (const m of mr.filter((m) => m.state !== 'closed' && m.target_branch !== 'production')) {
      // close じゃない & mainブランチターゲットのみ
      const commits = await store.loader.commits(m.iid).catch(() => [])
      const discussions = await store.loader.discussions(m.iid).catch(() => [])
      // リリースされたコミットにMR マージコミットが含まれるかどうか
      const releasedCommit =
        m.merge_commit_sha !== undefined && m.merge_commit_sha !== null && (await store.loader.releasedCommitsBySha(m.merge_commit_sha).catch(() => false))

      const item: MergeRequest = {
        id: String(m.iid),
        target_branch: m.target_branch,
        state: m.state,
        num_of_commits: commits.length || null,
        num_of_comments: aggregator.reviewComments(discussions).length || null,
        first_commited_at: nullOrDate(aggregator.firstCommit(commits)?.created_at),
        mergerequest_created_at: nullOrDate(m.created_at)!,
        first_reviewd_at: nullOrDate(aggregator.firstReviewComment(discussions, (m.author as Types.UserSchema).username)?.created_at),
        merged_at: nullOrDate(m.merged_at),
        released_at: nullOrDate(await store.loader.findReleaseDate(mr, m.merge_commit_sha)), // リリース日時 = production ブランチ対象MRに含まれる commits を MR merge_commit_sha で探してきてMRを特定し、そこの merged_at
        is_release_committed: releasedCommit !== false,
        author: m.author.username as string,
        title: m.title,
        repositoryId: repository.id
      }

      await got.post(API_URL, { json: { item } })
    }
  }
}
