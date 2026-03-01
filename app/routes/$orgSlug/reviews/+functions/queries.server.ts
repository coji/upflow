import { sql, type SqlBool } from 'kysely'
import {
  getTenantDb,
  type OrganizationId,
} from '~/app/services/tenant-db.server'

/**
 * A. レビュアー別のキュー — 共通のベースクエリ
 */
const reviewerQueueBaseQuery = (
  organizationId: OrganizationId,
  teamId?: string | null,
) => {
  const tenantDb = getTenantDb(organizationId)
  return tenantDb
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
      'companyGithubUsers',
      'pullRequestReviewers.reviewer',
      'companyGithubUsers.login',
    )
    .where('pullRequests.state', '=', 'open')
    .where('pullRequests.mergedAt', 'is', null)
    .where(({ not, exists, selectFrom }) =>
      not(
        exists(
          selectFrom('pullRequestReviews')
            .whereRef(
              'pullRequestReviews.pullRequestNumber',
              '=',
              'pullRequestReviewers.pullRequestNumber',
            )
            .whereRef(
              'pullRequestReviews.repositoryId',
              '=',
              'pullRequestReviewers.repositoryId',
            )
            .whereRef(
              'pullRequestReviews.reviewer',
              '=',
              'pullRequestReviewers.reviewer',
            )
            .where('pullRequestReviews.state', 'in', [
              'APPROVED',
              'CHANGES_REQUESTED',
            ])
            .select(sql<SqlBool>`1`.as('one')),
        ),
      ),
    )
    .$if(teamId != null, (qb) =>
      qb.where('repositories.teamId', '=', teamId as string),
    )
}

/**
 * A-1. レビュアー別のキュー深度（集計済み）
 */
export const getReviewerQueueDistribution = async (
  organizationId: OrganizationId,
  teamId?: string | null,
) => {
  return await reviewerQueueBaseQuery(organizationId, teamId)
    .groupBy('pullRequestReviewers.reviewer')
    .orderBy(sql`count(*)`, 'desc')
    .select([
      'pullRequestReviewers.reviewer',
      'companyGithubUsers.displayName',
      sql<number>`count(*)`.as('queueCount'),
    ])
    .execute()
}

/**
 * A-2. レビュアー別のキュー — 個別PR一覧（ドリルダウン用）
 */
export const getReviewerQueuePRs = async (
  organizationId: OrganizationId,
  teamId?: string | null,
) => {
  return await reviewerQueueBaseQuery(organizationId, teamId)
    .select([
      'pullRequestReviewers.reviewer',
      'pullRequests.number',
      'pullRequests.title',
      'pullRequests.url',
      'pullRequests.repo',
      'pullRequests.author',
      'pullRequests.pullRequestCreatedAt',
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
    .leftJoin(
      'companyGithubUsers',
      'pullRequests.author',
      'companyGithubUsers.login',
    )
    .where('pullRequests.mergedAt', 'is not', null)
    .where('pullRequests.reviewTime', 'is not', null)
    .where('pullRequests.author', 'not like', '%[bot]')
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
    .where('pullRequests.mergedAt', 'is not', null)
    .where('pullRequests.author', 'not like', '%[bot]')
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
    ])
    .execute()
}
