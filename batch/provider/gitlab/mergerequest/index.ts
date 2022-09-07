import type { ShapedGitLabMergeRequest } from '../model'
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
  mergerequests: ShapedGitLabMergeRequest[]
) => {
  const store = createStore(config)
  const aggregator = createAggregator()

  const results: PullRequest[] = []
  for (const m of mergerequests) {
    const commits = await store.loader.commits(m.iid).catch(() => [])
    const discussions = await store.loader.discussions(m.iid).catch(() => [])

    const firstCommittedAt = nullOrDate(aggregator.firstCommit(commits)?.createdAt)
    const pullRequestCreatedAt = dayjs(m.createdAt).format()
    const firstReviewedAt = nullOrDate(aggregator.firstReviewComment(discussions, m.author)?.createdAt)
    const mergedAt = nullOrDate(m.mergedAt)
    const releasedAt = nullOrDate(await store.loader.findReleaseDate(mergerequests, m.mergeCommitSha)) // リリース日時 = production ブランチ対象MRに含まれる commits を MR merge_commit_sha で探してきてMRを特定し、そこの merged_at

    results.push({
      repo: String(m.projectId),
      number: String(m.iid),
      sourceBranch: m.sourceBranch,
      targetBranch: m.targetBranch,
      state: m.state,
      author: m.author,
      title: m.title,
      url: m.url,
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
