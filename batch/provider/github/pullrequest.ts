import type { Selectable } from 'kysely'
import { first } from 'remeda'
import dayjs from '~/app/libs/dayjs'
import type { OrganizationId, TenantDB } from '~/app/services/tenant-db.server'
import {
  codingTime,
  deployTime,
  pickupTime,
  reviewTime,
  totalTime,
} from '~/batch/bizlogic/cycletime'
import { logger } from '~/batch/helper/logger'
import type {
  ShapedGitHubCommit,
  ShapedGitHubPullRequest,
  ShapedGitHubReview,
  ShapedGitHubReviewComment,
} from './model'
import { findReleaseDate } from './release-detect'
import { analyzeReviewResponse } from './review-response'
import type { PullRequestLoaders } from './types'

// デフォルトで除外するユーザー (GitHub API で [bot] 接尾辞なしで記録されるbot)
const DEFAULT_EXCLUDED_USERS = ['Copilot']

/** PR に関連するアーティファクトの型 */
interface PrArtifacts {
  commits: ShapedGitHubCommit[]
  reviews: ShapedGitHubReview[]
  discussions: ShapedGitHubReviewComment[]
}

/** PR の各種日時 */
interface PrDates {
  firstCommittedAt: string | null
  pullRequestCreatedAt: string
  firstReviewedAt: string | null
  mergedAt: string | null
}

/** buildPullRequests の設定 */
interface BuildConfig {
  organizationId: OrganizationId
  repositoryId: string
  releaseDetectionMethod: string
  releaseDetectionKey: string
  excludedUsers: string
}

const nullOrDate = (dateStr?: Date | string | null) => {
  return dateStr ? dayjs(dateStr).utc().toISOString() : null
}

/**
 * PR に関連するアーティファクトを読み込む（I/O を含む）
 */
async function loadPrArtifacts(
  pr: ShapedGitHubPullRequest,
  loaders: PullRequestLoaders,
): Promise<PrArtifacts> {
  return {
    commits: await loaders.commits(pr.number),
    reviews: await loaders.reviews(pr.number),
    discussions: await loaders.discussions(pr.number),
  }
}

/**
 * bot と PR 作成者、除外ユーザーをフィルタリング（純粋関数）
 */
function filterActors(
  artifacts: PrArtifacts,
  pr: ShapedGitHubPullRequest,
  excludedUsers: string[],
): PrArtifacts {
  return {
    commits: artifacts.commits,
    reviews: artifacts.reviews.filter(
      (r) =>
        !r.isBot &&
        r.user !== pr.author &&
        !excludedUsers.includes(r.user ?? ''),
    ),
    discussions: artifacts.discussions.filter(
      (d) =>
        !d.isBot &&
        d.user !== pr.author &&
        !excludedUsers.includes(d.user ?? ''),
    ),
  }
}

/**
 * PR の各種日時を計算（純粋関数）
 */
function computeDates(
  pr: ShapedGitHubPullRequest,
  artifacts: PrArtifacts,
): PrDates {
  return {
    firstCommittedAt: nullOrDate(
      artifacts.commits.length > 0 ? artifacts.commits[0].date : null,
    ),
    pullRequestCreatedAt: nullOrDate(pr.created_at) ?? '',
    firstReviewedAt: nullOrDate(
      first(artifacts.discussions)?.created_at ??
        first(artifacts.reviews)?.submitted_at,
    ),
    mergedAt: nullOrDate(pr.merged_at),
  }
}

/**
 * PR 行データを生成（純粋関数）
 */
function buildPullRequestRow(
  pr: ShapedGitHubPullRequest,
  dates: PrDates,
  releasedAt: string | null,
  repositoryId: string,
): Selectable<TenantDB.PullRequests> {
  return {
    repo: pr.repo,
    number: pr.number,
    sourceBranch: pr.source_branch,
    targetBranch: pr.target_branch,
    state: (pr.state === 'closed' && !!pr.merged_at ? 'merged' : pr.state) as
      | 'open'
      | 'closed'
      | 'merged',
    author: pr.author ?? '',
    title: pr.title,
    url: pr.url,
    firstCommittedAt: dates.firstCommittedAt,
    pullRequestCreatedAt: dates.pullRequestCreatedAt,
    firstReviewedAt: dates.firstReviewedAt,
    mergedAt: dates.mergedAt,
    releasedAt,
    codingTime: codingTime({
      firstCommittedAt: dates.firstCommittedAt,
      pullRequestCreatedAt: dates.pullRequestCreatedAt,
    }),
    pickupTime: pickupTime({
      pullRequestCreatedAt: dates.pullRequestCreatedAt,
      firstReviewedAt: dates.firstReviewedAt,
      mergedAt: dates.mergedAt,
    }),
    reviewTime: reviewTime({
      firstReviewedAt: dates.firstReviewedAt,
      mergedAt: dates.mergedAt,
    }),
    deployTime: deployTime({
      mergedAt: dates.mergedAt,
      releasedAt,
    }),
    totalTime: totalTime({
      firstCommittedAt: dates.firstCommittedAt,
      pullRequestCreatedAt: dates.pullRequestCreatedAt,
      firstReviewedAt: dates.firstReviewedAt,
      mergedAt: dates.mergedAt,
      releasedAt,
    }),
    repositoryId,
    updatedAt: nullOrDate(pr.updated_at),
    additions: pr.additions,
    deletions: pr.deletions,
    changedFiles: pr.changed_files,
  }
}

export const buildPullRequests = async (
  config: BuildConfig,
  pullrequests: ShapedGitHubPullRequest[],
  loaders: PullRequestLoaders,
) => {
  // カンマ区切りの除外ユーザーリストをパース
  const customExcludedUsers = config.excludedUsers
    .split(',')
    .map((u) => u.trim())
    .filter((u) => u.length > 0)
  const excludedUsers = [...DEFAULT_EXCLUDED_USERS, ...customExcludedUsers]

  const pulls: Selectable<TenantDB.PullRequests>[] = []
  const reviews: {
    id: string
    pullRequestNumber: number
    repositoryId: string
    reviewer: string
    state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED'
    submittedAt: string
    url: string
  }[] = []
  const reviewers: {
    pullRequestNumber: number
    repositoryId: string
    reviewerLogins: string[]
  }[] = []
  const reviewResponses: {
    repo: string
    number: string
    author: string
    createdAt: string
    responseTime: number
  }[] = []

  for (const pr of pullrequests) {
    try {
      // 1. アーティファクト読み込み（I/O）
      const rawArtifacts = await loadPrArtifacts(pr, loaders)

      // 2. アクター除外フィルタ（純粋関数）
      const artifacts = filterActors(rawArtifacts, pr, excludedUsers)

      // 3. レビューレスポンス解析
      reviewResponses.push(
        ...analyzeReviewResponse(artifacts.discussions).map((res) => ({
          repo: String(pr.repo),
          number: String(pr.number),
          author: res.author ?? '',
          createdAt: res.createdAt,
          responseTime: res.responseTime,
        })),
      )

      // 4. 日時計算（純粋関数）
      const dates = computeDates(pr, artifacts)

      // 5. リリース日時計算（I/O を含む）
      const releasedAt =
        pr.merged_at && pr.merge_commit_sha
          ? await findReleaseDate(
              pullrequests,
              loaders,
              pr,
              config.releaseDetectionMethod,
              config.releaseDetectionKey,
            )
          : null

      // 6. PR 行データ生成（純粋関数）
      pulls.push(
        buildPullRequestRow(pr, dates, releasedAt, config.repositoryId),
      )

      // 7. レビュー情報を収集（PENDING レビューは submitted_at がないため除外）
      for (const review of rawArtifacts.reviews) {
        if (!review.user || !review.submitted_at) continue
        reviews.push({
          id: String(review.id),
          pullRequestNumber: pr.number,
          repositoryId: config.repositoryId,
          reviewer: review.user,
          state: review.state as
            | 'APPROVED'
            | 'CHANGES_REQUESTED'
            | 'COMMENTED'
            | 'DISMISSED',
          submittedAt: review.submitted_at,
          url: review.url,
        })
      }

      // 8. レビュアー（レビュー依頼先）情報を収集
      const reviewerLogins = pr.reviewers ?? []
      if (reviewerLogins.length > 0) {
        reviewers.push({
          pullRequestNumber: pr.number,
          repositoryId: config.repositoryId,
          reviewerLogins,
        })
      }
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

  return { pulls, reviews, reviewers, reviewResponses }
}
