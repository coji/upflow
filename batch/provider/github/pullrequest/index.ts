import type { ShapedGitHubPullRequest } from '../model'
import type { PullRequest } from '@prisma/client'
import dayjs from '~/app/libs/dayjs'
import { createStore } from '../store'
import { codingTime, pickupTime, reviewTime, deployTime, totalTime } from '~/batch/bizlogic/cycletime'
import { findReleaseDate } from '../release-detect'
import { first } from 'remeda'
import { logger } from '~/batch/helper/logger'
import { analyzeReviewResponse } from '../review-response'

const nullOrDate = (dateStr?: Date | string | null) => {
  return dateStr ? dayjs(dateStr).utc().toISOString() : null
}

export const buildPullRequests = async (
  config: { companyId: string; repositoryId: string; releaseDetectionMethod: string; releaseDetectionKey: string },
  pullrequests: ShapedGitHubPullRequest[],
) => {
  const store = createStore(config)

  const pulls: PullRequest[] = []
  const reviewResponses: { repo: string; number: string; author: string; createdAt: string; responseTime: number }[] =
    []
  for (const pr of pullrequests) {
    try {
      const commits = await store.loader.commits(pr.number)
      const reviews = await store.loader.reviews(pr.number)
      const discussions = await store.loader.discussions(pr.number)

      reviewResponses.push(
        ...analyzeReviewResponse(discussions).map((res) => ({
          repo: String(pr.repo),
          number: String(pr.number),
          author: res.author,
          createdAt: res.createdAt,
          responseTime: res.responseTime,
        })),
      )

      const firstCommittedAt = nullOrDate(commits.length > 0 ? commits[0].date : null)
      const pullRequestCreatedAt = nullOrDate(pr.createdAt) ?? ''
      const firstReviewedAt = nullOrDate(first(discussions)?.createdAt ?? first(reviews)?.submittedAt) // レビュー開始 = コメント最新 or レビュー submit 最新
      const mergedAt = nullOrDate(pr.mergedAt)
      const releasedAt =
        pr.mergedAt && pr.mergeCommitSha
          ? await findReleaseDate(
              pullrequests,
              store,
              pr.mergeCommitSha,
              config.releaseDetectionMethod,
              config.releaseDetectionKey,
            )
          : null

      pulls.push({
        repo: pr.repo,
        number: String(pr.number),
        sourceBranch: pr.sourceBranch,
        targetBranch: pr.targetBranch,
        state: pr.state === 'closed' && !!pr.mergedAt ? 'merged' : pr.state, // github は api では merged にならないので
        author: pr.author ?? '',
        title: pr.title,
        url: pr.url,
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
        updatedAt: nullOrDate(pr.updatedAt),
      })
    } catch (e) {
      await logger.error('analyze failure:', config.companyId, config.repositoryId, pr.number, e)
    }
  }
  return { pulls, reviewResponses }
}
