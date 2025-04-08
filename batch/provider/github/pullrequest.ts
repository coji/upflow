import { first } from 'remeda'
import dayjs from '~/app/libs/dayjs'
import type { DB, Selectable } from '~/app/services/db.server'
import {
  codingTime,
  deployTime,
  pickupTime,
  reviewTime,
  totalTime,
} from '~/batch/bizlogic/cycletime'
import { logger } from '~/batch/helper/logger'
import type { ShapedGitHubPullRequest } from './model'
import { findReleaseDate } from './release-detect'
import { analyzeReviewResponse } from './review-response'
import { createStore } from './store'

const nullOrDate = (dateStr?: Date | string | null) => {
  return dateStr ? dayjs(dateStr).utc().toISOString() : null
}

export const buildPullRequests = async (
  config: {
    organizationId: string
    repositoryId: string
    releaseDetectionMethod: string
    releaseDetectionKey: string
  },
  pullrequests: ShapedGitHubPullRequest[],
) => {
  const store = createStore(config)

  const pulls: Selectable<DB.PullRequest>[] = []
  const reviewResponses: {
    repo: string
    number: string
    author: string
    createdAt: string
    responseTime: number
  }[] = []
  for (const pr of pullrequests) {
    try {
      // コミット履歴
      const commits = await store.loader.commits(pr.number)

      // レビュー履歴 (bot と PR 作成者は除外)
      const reviews = (await store.loader.reviews(pr.number)).filter(
        (r) => !r.user?.endsWith('[bot]') && r.user !== pr.author,
      )
      // コメント履歴 (bot と PR 作成者は除外)
      const discussions = (await store.loader.discussions(pr.number)).filter(
        (d) => !d.user.endsWith('[bot]') && d.user !== pr.author,
      )

      reviewResponses.push(
        ...analyzeReviewResponse(discussions).map((res) => ({
          repo: String(pr.repo),
          number: String(pr.number),
          author: res.author,
          createdAt: res.createdAt,
          responseTime: res.responseTime,
        })),
      )

      // 初期コミット日時
      const firstCommittedAt = nullOrDate(
        commits.length > 0 ? commits[0].date : null,
      )

      // プルリク作成日時
      const pullRequestCreatedAt = nullOrDate(pr.created_at) ?? ''

      // レビュー開始日時
      const firstReviewedAt = nullOrDate(
        first(discussions)?.created_at ?? first(reviews)?.submitted_at,
      ) // レビュー開始 = コメント最新 or レビュー submit 最新

      // マージ日時
      const mergedAt = nullOrDate(pr.merged_at)

      // リリース日時
      const releasedAt =
        pr.merged_at && pr.merge_commit_sha
          ? await findReleaseDate(
              pullrequests,
              store,
              pr,
              config.releaseDetectionMethod,
              config.releaseDetectionKey,
            )
          : null

      pulls.push({
        repo: pr.repo,
        number: pr.number,
        sourceBranch: pr.source_branch,
        targetBranch: pr.target_branch,
        state: pr.state === 'closed' && !!pr.merged_at ? 'merged' : pr.state, // github は api では merged にならないので
        author: pr.author ?? '',
        title: pr.title,
        url: pr.url,
        firstCommittedAt,
        pullRequestCreatedAt,
        firstReviewedAt,
        mergedAt,
        releasedAt,
        codingTime: codingTime({ firstCommittedAt, pullRequestCreatedAt }),
        pickupTime: pickupTime({
          pullRequestCreatedAt,
          firstReviewedAt,
          mergedAt,
        }),
        reviewTime: reviewTime({ firstReviewedAt, mergedAt }),
        deployTime: deployTime({ mergedAt, releasedAt }),
        totalTime: totalTime({
          firstCommittedAt,
          pullRequestCreatedAt,
          firstReviewedAt,
          mergedAt,
          releasedAt,
        }),
        repositoryId: config.repositoryId,
        updatedAt: nullOrDate(pr.updated_at),
      })
    } catch (e) {
      logger.error(
        'analyze failure:',
        config.organizationId,
        config.repositoryId,
        pr.number,
        e,
      )
    }
  }
  return { pulls, reviewResponses }
}
