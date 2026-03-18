import type { Selectable } from 'kysely'
import { first } from 'remeda'
import dayjs from '~/app/libs/dayjs'
import type { TenantDB } from '~/app/services/tenant-db.server'
import type { OrganizationId } from '~/app/types/organization'
import {
  codingTime,
  deployTime,
  pickupTime,
  reviewTime,
  totalTime,
} from '~/batch/bizlogic/cycletime'
import { logger } from '~/batch/helper/logger'
import { buildRequestedAtMap } from './fetcher'
import type {
  ShapedGitHubCommit,
  ShapedGitHubPullRequest,
  ShapedGitHubReview,
  ShapedGitHubReviewComment,
} from './model'
import {
  buildBranchReleaseLookup,
  buildTagReleaseList,
  findReleaseDateFromTags,
} from './release-detect'
import { analyzeReviewResponse } from './review-response'
import type {
  AnalyzedReview,
  AnalyzedReviewResponse,
  AnalyzedReviewer,
  PullRequestLoaders,
} from './types'

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
  botLogins: Set<string>
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
  botLogins: Set<string>,
): PrArtifacts {
  return {
    commits: artifacts.commits,
    reviews: artifacts.reviews.filter(
      (r) =>
        !r.isBot &&
        r.user !== pr.author &&
        !botLogins.has((r.user ?? '').toLowerCase()),
    ),
    discussions: artifacts.discussions.filter(
      (d) =>
        !d.isBot &&
        d.user !== pr.author &&
        !botLogins.has((d.user ?? '').toLowerCase()),
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
    pullRequestCreatedAt: nullOrDate(pr.createdAt) ?? '',
    firstReviewedAt: nullOrDate(
      first(artifacts.discussions)?.createdAt ??
        first(artifacts.reviews)?.submittedAt,
    ),
    mergedAt: nullOrDate(pr.mergedAt),
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
    sourceBranch: pr.sourceBranch,
    targetBranch: pr.targetBranch,
    state: pr.state === 'closed' && pr.mergedAt ? 'merged' : pr.state,
    author: pr.author ?? '',
    title: pr.title,
    url: pr.url,
    firstCommittedAt: dates.firstCommittedAt,
    pullRequestCreatedAt: dates.pullRequestCreatedAt,
    firstReviewedAt: dates.firstReviewedAt,
    mergedAt: dates.mergedAt,
    closedAt: nullOrDate(pr.closedAt),
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
    updatedAt: nullOrDate(pr.updatedAt),
    additions: pr.additions,
    deletions: pr.deletions,
    changedFiles: pr.changedFiles,
    complexity: null,
    complexityReason: null,
    riskAreas: null,
    classifiedAt: null,
    classifierModel: null,
  }
}

export const buildPullRequests = async (
  config: BuildConfig,
  pullrequests: ShapedGitHubPullRequest[],
  loaders: PullRequestLoaders,
  filterPrNumbers?: Set<number>,
) => {
  // リリース日ルックアップを事前構築
  // 注: filterPrNumbers に関係なく全 PR から構築する（リリースPR自体がフィルタ外でも必要）
  let branchReleaseLookup: Map<number, string> | null = null
  let tagReleaseList: { committedAt: string }[] | null = null

  if (config.releaseDetectionMethod === 'branch') {
    branchReleaseLookup = buildBranchReleaseLookup(
      pullrequests,
      config.releaseDetectionKey,
    )
  } else if (config.releaseDetectionMethod === 'tags') {
    tagReleaseList = await buildTagReleaseList(
      loaders,
      config.releaseDetectionKey,
    )
  }

  const pulls: Selectable<TenantDB.PullRequests>[] = []
  const reviews: AnalyzedReview[] = []
  const reviewers: AnalyzedReviewer[] = []
  const reviewResponses: AnalyzedReviewResponse[] = []
  const botUsers = new Set<string>()

  let processed = 0
  for (const pr of pullrequests) {
    // フィルタが指定されていれば、対象外PRをスキップ
    if (filterPrNumbers && !filterPrNumbers.has(pr.number)) {
      continue
    }

    // Yield to event loop periodically to prevent blocking healthchecks
    if (++processed % 50 === 0) {
      await new Promise<void>((r) => setTimeout(r, 0))
    }

    try {
      // 1. アーティファクト読み込み（I/O）
      const rawArtifacts = await loadPrArtifacts(pr, loaders)

      // 2. bot ユーザーを収集（GitHub API の __typename === 'Bot'）
      for (const r of rawArtifacts.reviews) {
        if (r.isBot && r.user) botUsers.add(r.user.toLowerCase())
      }
      for (const d of rawArtifacts.discussions) {
        if (d.isBot && d.user) botUsers.add(d.user.toLowerCase())
      }

      // 3. アクター除外フィルタ（純粋関数）
      const artifacts = filterActors(rawArtifacts, pr, config.botLogins)

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

      // 5. リリース日時計算（事前計算済みルックアップから O(1) or O(log n) で取得）
      let releasedAt: string | null = null
      if (pr.mergedAt) {
        if (branchReleaseLookup) {
          releasedAt = branchReleaseLookup.get(pr.number) ?? null
        } else if (tagReleaseList) {
          releasedAt = findReleaseDateFromTags(pr.mergedAt, tagReleaseList)
        }
      }

      // 6. PR 行データ生成（純粋関数）
      pulls.push(
        buildPullRequestRow(pr, dates, releasedAt, config.repositoryId),
      )

      // 7. レビュー情報を収集（PENDING レビューは submittedAt がないため除外）
      for (const review of rawArtifacts.reviews) {
        if (!review.user || !review.submittedAt || review.state === 'PENDING')
          continue
        reviews.push({
          id: String(review.id),
          pullRequestNumber: pr.number,
          repositoryId: config.repositoryId,
          reviewer: review.user,
          state: review.state,
          submittedAt: review.submittedAt,
          url: review.url,
        })
      }

      // 8. レビュアー（レビュー依頼先）情報を収集
      //    timeline_items から requestedAt を補完する
      //    reviewer が 0 人でも push して、removed された reviewer の DB レコードを削除させる
      const prReviewers = pr.reviewers ?? []
      const requestedAtMap =
        prReviewers.length > 0
          ? buildRequestedAtMap(await loaders.timelineItems(pr.number))
          : new Map<string, string>()
      reviewers.push({
        pullRequestNumber: pr.number,
        repositoryId: config.repositoryId,
        reviewers: prReviewers.map((r) => ({
          ...r,
          requestedAt: requestedAtMap.get(r.login) ?? r.requestedAt,
        })),
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

  return { pulls, reviews, reviewers, reviewResponses, botUsers }
}
