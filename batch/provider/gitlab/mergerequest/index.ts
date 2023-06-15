import type { ShapedGitLabMergeRequest } from '../model'
import type { PullRequest } from '@prisma/client'
import dayjs from '~/app/libs/dayjs'
import { createAggregator } from '../aggregator'
import { createStore } from '../store'
import { codingTime, pickupTime, reviewTime, deployTime, totalTime } from '~/batch/bizlogic/cycletime'
import { findReleaseDate } from '../release-detect'
import { logger } from '~/batch/helper/logger'
import { analyzeReviewResponse } from '../review-response'

const nullOrDate = (dateStr?: Date | string | null) => {
  return dateStr ? dayjs(dateStr).utc().toISOString() : null
}

export const buildMergeRequests = async (
  config: {
    companyId: string
    repositoryId: string
    releaseDetectionMethod: string
    releaseDetectionKey: string
  },
  mergerequests: ShapedGitLabMergeRequest[],
) => {
  const store = createStore(config)
  const aggregator = createAggregator()

  const pulls: PullRequest[] = []
  const reviewResponses: { repo: string; number: string; author: string; createdAt: string; responseTime: number }[] =
    []
  for (const m of mergerequests) {
    try {
      const commits = await store.loader.commits(m.iid).catch(() => [])
      const discussions = await store.loader.discussions(m.iid).catch(() => [])

      reviewResponses.push(
        ...analyzeReviewResponse(discussions).map((res) => ({
          repo: String(m.projectId),
          number: String(m.iid),
          author: res.author,
          createdAt: res.createdAt,
          responseTime: res.responseTime,
        })),
      )

      const firstCommittedAt = nullOrDate(aggregator.firstCommit(commits)?.createdAt)
      const pullRequestCreatedAt = nullOrDate(m.createdAt) ?? ''
      const firstReviewedAt = nullOrDate(aggregator.firstReviewComment(discussions, m.author)?.createdAt)
      const mergedAt = nullOrDate(m.mergedAt)
      const releasedAt = nullOrDate(
        m.mergeCommitSha ? await findReleaseDate(mergerequests, store, m, config.releaseDetectionKey) : null,
      )

      pulls.push({
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
        repositoryId: config.repositoryId,
        updatedAt: nullOrDate(m.updatedAt),
      })
    } catch (e) {
      await logger.error('analyze failure:', config.companyId, config.repositoryId, m.iid, e)
    }
  }
  return { pulls, reviewResponses }
}
