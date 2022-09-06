import type { ShapedGitHubPullRequest } from '../model'
import type { PullRequest } from '@prisma/client'
import dayjs from 'dayjs'
import { createStore } from '../store'
import { codingTime, pickupTime, reviewTime, deployTime, totalTime } from '~/batch/bizlogic/cycletime'

const nullOrDate = (dateStr?: Date | string | null) => {
  return dateStr ? dayjs(dateStr).format() : null
}

export const buildPullRequests = async (
  config: { companyId: string; repositoryId: string },
  pullrequests: ShapedGitHubPullRequest[]
) => {
  const store = createStore(config)

  const results: PullRequest[] = []
  for (const pr of pullrequests) {
    // close じゃない
    const commits = await store.loader.commits(pr.number)
    const discussions = await store.loader.discussions(pr.number)

    const firstCommittedAt = nullOrDate(commits[0].date)
    const pullRequestCreatedAt = nullOrDate(pr.createdAt)!
    const firstReviewedAt = nullOrDate(discussions[0].createdAt)
    const mergedAt = nullOrDate(pr.mergedAt)
    const releasedAt = null // TODO: releasedAt をちゃんと計算

    // リリースされたコミットにMR マージコミットが含まれるかどうか
    const isReleased =
      pr.mergeCommitSha !== undefined &&
      pr.mergeCommitSha !== null &&
      (await store.loader.releasedCommitsBySha(pr.mergeCommitSha).catch(() => null)) != null

    results.push({
      repo: pr.repo,
      number: String(pr.number),
      targetBranch: pr.targetBranch,
      state: pr.state,
      author: pr.author ?? '',
      title: pr.title,
      url: pr.url,
      isReleased,
      firstCommittedAt,
      pullRequestCreatedAt,
      firstReviewedAt,
      mergedAt,
      releasedAt: null,
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
