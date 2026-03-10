import { sql } from 'kysely'
import { getTenantDb } from '~/app/services/tenant-db.server'
import type { OrganizationId } from '~/app/types/organization'

/**
 * A. キュー履歴の生データ
 * 各 reviewer 割り当てについて「いつからいつまで pending だったか」を返す。
 * 期間中に open だったものすべてを取る。
 */
export const getQueueHistoryRawData = async (
  organizationId: OrganizationId,
  sinceDate: string,
  teamId?: string | null,
) => {
  const tenantDb = getTenantDb(organizationId)
  return await tenantDb
    .selectFrom('pullRequestReviewers')
    .innerJoin('pullRequests', (join) =>
      join
        .onRef(
          'pullRequestReviewers.pullRequestNumber',
          '=',
          'pullRequests.number',
        )
        .onRef(
          'pullRequestReviewers.repositoryId',
          '=',
          'pullRequests.repositoryId',
        ),
    )
    .innerJoin('repositories', 'pullRequests.repositoryId', 'repositories.id')
    .leftJoin(
      (eb) =>
        eb
          .selectFrom('pullRequestReviews')
          .select([
            'pullRequestReviews.pullRequestNumber',
            'pullRequestReviews.repositoryId',
            'pullRequestReviews.reviewer',
            sql<string>`min(pull_request_reviews.submitted_at)`.as(
              'firstResolvedAt',
            ),
          ])
          .where('pullRequestReviews.state', 'in', [
            'APPROVED',
            'CHANGES_REQUESTED',
          ])
          .groupBy([
            'pullRequestReviews.pullRequestNumber',
            'pullRequestReviews.repositoryId',
            'pullRequestReviews.reviewer',
          ])
          .as('resolvedReview'),
      (join) =>
        join
          .onRef(
            'resolvedReview.pullRequestNumber',
            '=',
            'pullRequestReviewers.pullRequestNumber',
          )
          .onRef(
            'resolvedReview.repositoryId',
            '=',
            'pullRequestReviewers.repositoryId',
          )
          .onRef(
            'resolvedReview.reviewer',
            '=',
            'pullRequestReviewers.reviewer',
          ),
    )
    .where('pullRequestReviewers.requestedAt', 'is not', null)
    // 期間中に open だったものすべてを取る
    .where('pullRequestReviewers.requestedAt', '<=', new Date().toISOString())
    .where(({ or, eb }) =>
      or([
        eb('resolvedReview.firstResolvedAt', 'is', null),
        eb('resolvedReview.firstResolvedAt', '>=', sinceDate),
      ]),
    )
    .where(({ or, eb }) =>
      or([
        eb('pullRequests.mergedAt', 'is', null),
        eb('pullRequests.mergedAt', '>=', sinceDate),
      ]),
    )
    .$if(teamId != null, (qb) =>
      qb.where('repositories.teamId', '=', teamId as string),
    )
    .select([
      'pullRequestReviewers.requestedAt',
      'resolvedReview.firstResolvedAt as resolvedAt',
      'pullRequests.mergedAt',
      'pullRequests.closedAt',
    ])
    .execute()
}

/**
 * B. WIP数とサイクルタイムの相関データ
 * マージ済みPRの生データを返す。WIP数の計算はクライアント側で行う。
 */
export const getWipCycleRawData = async (
  organizationId: OrganizationId,
  sinceDate: string,
  teamId?: string | null,
) => {
  const tenantDb = getTenantDb(organizationId)
  return await tenantDb
    .selectFrom('pullRequests')
    .innerJoin('repositories', 'pullRequests.repositoryId', 'repositories.id')
    .leftJoin('companyGithubUsers', (join) =>
      join.onRef(
        (eb) => eb.fn('lower', ['pullRequests.author']),
        '=',
        (eb) => eb.fn('lower', ['companyGithubUsers.login']),
      ),
    )
    .where('pullRequests.mergedAt', 'is not', null)
    .where('pullRequests.reviewTime', 'is not', null)

    .where('pullRequests.mergedAt', '>=', sinceDate)
    .$if(teamId != null, (qb) =>
      qb.where('repositories.teamId', '=', teamId as string),
    )
    .select([
      'pullRequests.author',
      'pullRequests.number',
      'pullRequests.repositoryId',
      'pullRequests.title',
      'pullRequests.url',
      'pullRequests.repo',
      'pullRequests.reviewTime',
      'pullRequests.pullRequestCreatedAt',
      'pullRequests.mergedAt',
      'pullRequests.additions',
      'pullRequests.deletions',
      'pullRequests.complexity',
      'pullRequests.complexityReason',
      'pullRequests.riskAreas',
      'companyGithubUsers.displayName as authorDisplayName',
    ])
    .execute()
}

/**
 * C. PRサイズ分布データ（マージ済みPRのadditions/deletions + review_time）
 */
export const getPRSizeDistribution = async (
  organizationId: OrganizationId,
  sinceDate: string,
  teamId?: string | null,
) => {
  const tenantDb = getTenantDb(organizationId)
  return await tenantDb
    .selectFrom('pullRequests')
    .innerJoin('repositories', 'pullRequests.repositoryId', 'repositories.id')
    .leftJoin('companyGithubUsers', (join) =>
      join.onRef(
        (eb) => eb.fn('lower', ['pullRequests.author']),
        '=',
        (eb) => eb.fn('lower', ['companyGithubUsers.login']),
      ),
    )
    .where('pullRequests.mergedAt', 'is not', null)

    .where('pullRequests.mergedAt', '>=', sinceDate)
    .where('pullRequests.additions', 'is not', null)
    .where('pullRequests.deletions', 'is not', null)
    .$if(teamId != null, (qb) =>
      qb.where('repositories.teamId', '=', teamId as string),
    )
    .select([
      'pullRequests.number',
      'pullRequests.title',
      'pullRequests.url',
      'pullRequests.repo',
      'pullRequests.author',
      'pullRequests.additions',
      'pullRequests.deletions',
      'pullRequests.changedFiles',
      'pullRequests.reviewTime',
      'pullRequests.pickupTime',
      'pullRequests.complexity',
      'pullRequests.complexityReason',
      'pullRequests.riskAreas',
      'companyGithubUsers.displayName as authorDisplayName',
    ])
    .execute()
}
