import type { GitLabMergeRequest, GitLabUser } from '../model'
import type { MergeRequest } from '@prisma/client'
import dayjs from 'dayjs'
import { createAggregator } from '../aggregator'
import { createStore } from '../store'

const nullOrDate = (dateStr?: Date | string | null) => {
  return dateStr ? dayjs(dateStr).format() : null
}

export const buildMergeRequests = async (
  config: { companyId: string; repositoryId: string },
  mergerequests: GitLabMergeRequest[]
) => {
  const store = createStore(config)
  const aggregator = createAggregator()

  const results: MergeRequest[] = []
  for (const m of mergerequests.filter((m) => m.state !== 'closed' && m.target_branch !== 'production')) {
    // close じゃない & mainブランチターゲットのみ
    const commits = await store.loader.commits(m.iid).catch(() => [])
    const discussions = await store.loader.discussions(m.iid).catch(() => [])
    // リリースされたコミットにMR マージコミットが含まれるかどうか
    const releasedCommit =
      m.merge_commit_sha !== undefined &&
      m.merge_commit_sha !== null &&
      (await store.loader.releasedCommitsBySha(m.merge_commit_sha).catch(() => false))

    results.push({
      id: String(m.iid),
      target_branch: m.target_branch,
      state: m.state,
      num_of_commits: commits.length || null,
      num_of_comments: aggregator.reviewComments(discussions).length || null,
      first_commited_at: nullOrDate(aggregator.firstCommit(commits)?.created_at),
      mergerequest_created_at: nullOrDate(m.created_at)!,
      first_reviewd_at: nullOrDate(
        aggregator.firstReviewComment(discussions, (m.author as GitLabUser).username)?.created_at
      ),
      merged_at: nullOrDate(m.merged_at),
      released_at: nullOrDate(await store.loader.findReleaseDate(mergerequests, m.merge_commit_sha)), // リリース日時 = production ブランチ対象MRに含まれる commits を MR merge_commit_sha で探してきてMRを特定し、そこの merged_at
      is_release_committed: releasedCommit !== false,
      author: m.author.username as string,
      title: m.title,
      repositoryId: config.repositoryId
    })
  }
  return results
}
