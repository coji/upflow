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

    const firstCommittedAt = nullOrDate(commits.length > 0 ? commits[0].date : null)
    const pullRequestCreatedAt = nullOrDate(pr.createdAt)!
    const firstReviewedAt = nullOrDate(discussions.length > 0 ? discussions[0].createdAt : null)
    const mergedAt = nullOrDate(pr.mergedAt)
    const releasedAt = null // TODO: releasedAt をちゃんと計算

    results.push({
      repo: pr.repo,
      number: String(pr.number),
      sourceBranch: pr.sourceBranch,
      targetBranch: pr.targetBranch,
      state: pr.state,
      author: pr.author ?? '',
      title: pr.title,
      url: pr.url,
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
