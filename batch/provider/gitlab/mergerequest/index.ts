import type { GitLabMergeRequest, GitLabUser } from '../model'
import type { PullRequest } from '@prisma/client'
import dayjs from 'dayjs'
import { createAggregator } from '../aggregator'
import { createStore } from '../store'
import { codingTime, pickupTime, reviewTime, deployTime, totalTime } from '~/batch/bizlogic/cycletime'

const nullOrDate = (dateStr?: Date | string | null) => {
  return dateStr ? dayjs(dateStr).format() : null
}

export const buildMergeRequests = async (
  config: { companyId: string; repositoryId: string },
  mergerequests: GitLabMergeRequest[]
) => {
  const store = createStore(config)
  const aggregator = createAggregator()

  const results: PullRequest[] = []
  for (const m of mergerequests) {
    const commits = await store.loader.commits(m.iid).catch(() => [])
    const discussions = await store.loader.discussions(m.iid).catch(() => [])
    // リリースされたコミットにMR マージコミットが含まれるかどうか
    const releasedCommit =
      m.merge_commit_sha !== undefined &&
      m.merge_commit_sha !== null &&
      (await store.loader.releasedCommitsBySha(m.merge_commit_sha).catch(() => false))

    const firstCommittedAt = nullOrDate(aggregator.firstCommit(commits)?.created_at)
    const pullRequestCreatedAt = nullOrDate(m.created_at)!
    const firstReviewedAt = nullOrDate(
      aggregator.firstReviewComment(discussions, (m.author as GitLabUser).username)?.created_at
    )
    const mergedAt = nullOrDate(m.merged_at)
    const releasedAt = nullOrDate(await store.loader.findReleaseDate(mergerequests, m.merge_commit_sha)) // リリース日時 = production ブランチ対象MRに含まれる commits を MR merge_commit_sha で探してきてMRを特定し、そこの merged_at

    results.push({
      repo: String(m.project_id),
      number: String(m.iid),
      targetBranch: m.target_branch,
      state: m.state,
      isReleased: releasedCommit !== false,
      author: m.author.username as string,
      title: m.title,
      url: m.web_url,
      firstCommittedAt,
      pullRequestCreatedAt,
      firstReviewedAt,
      mergedAt,
      releasedAt,
      codingTime: codingTime({ firstCommittedAt, pullRequestCreatedAt }),
      pickupTime: pickupTime({ pullRequestCreatedAt, firstReviewedAt, mergedAt }),
      reviewTime: reviewTime({ firstReviewedAt, mergedAt }),
      deployTime: deployTime({ mergedAt, releasedAt }),
      totalTime: totalTime({ firstCommittedAt, pullRequestCreatedAt, firstReviewedAt, mergedAt, releasedAt }),
      repositoryId: config.repositoryId
    })
  }
  return results
}
