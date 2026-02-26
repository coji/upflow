import type { Insertable } from 'kysely'
import {
  getTenantDb,
  type OrganizationId,
  type TenantDB,
} from '~/app/services/tenant-db.server'
import { timeFormatUTC } from '../helper/timeformat'

export function upsertPullRequest(
  organizationId: OrganizationId,
  data: Insertable<TenantDB.PullRequests>,
) {
  const firstCommittedAt = timeFormatUTC(data.firstCommittedAt)
  const pullRequestCreatedAt = timeFormatUTC(data.pullRequestCreatedAt)
  const firstReviewedAt = timeFormatUTC(data.firstReviewedAt)
  const mergedAt = timeFormatUTC(data.mergedAt)
  const releasedAt = timeFormatUTC(data.releasedAt)
  const updatedAt = timeFormatUTC(data.updatedAt)

  const tenantDb = getTenantDb(organizationId)
  return tenantDb
    .insertInto('pullRequests')
    .values({
      ...data,
      firstCommittedAt,
      pullRequestCreatedAt,
      firstReviewedAt,
      mergedAt,
      releasedAt,
      updatedAt,
    })
    .onConflict((oc) =>
      oc.columns(['repositoryId', 'number']).doUpdateSet((eb) => ({
        repo: eb.ref('excluded.repo'),
        author: eb.ref('excluded.author'),
        title: eb.ref('excluded.title'),
        url: eb.ref('excluded.url'),
        state: eb.ref('excluded.state'),
        targetBranch: eb.ref('excluded.targetBranch'),
        sourceBranch: eb.ref('excluded.sourceBranch'),
        mergedAt: eb.ref('excluded.mergedAt'),
        releasedAt: eb.ref('excluded.releasedAt'),
        firstCommittedAt: eb.ref('excluded.firstCommittedAt'),
        pullRequestCreatedAt: eb.ref('excluded.pullRequestCreatedAt'),
        firstReviewedAt: eb.ref('excluded.firstReviewedAt'),
        codingTime: eb.ref('excluded.codingTime'),
        pickupTime: eb.ref('excluded.pickupTime'),
        reviewTime: eb.ref('excluded.reviewTime'),
        deployTime: eb.ref('excluded.deployTime'),
        totalTime: eb.ref('excluded.totalTime'),
        updatedAt: eb.ref('excluded.updatedAt'),
        additions: eb.ref('excluded.additions'),
        deletions: eb.ref('excluded.deletions'),
        changedFiles: eb.ref('excluded.changedFiles'),
      })),
    )
    .executeTakeFirst()
}

export function upsertPullRequestReview(
  organizationId: OrganizationId,
  data: Insertable<TenantDB.PullRequestReviews>,
) {
  const tenantDb = getTenantDb(organizationId)
  return tenantDb
    .insertInto('pullRequestReviews')
    .values(data)
    .onConflict((oc) =>
      oc.column('id').doUpdateSet((eb) => ({
        state: eb.ref('excluded.state'),
        url: eb.ref('excluded.url'),
        reviewer: eb.ref('excluded.reviewer'),
        submittedAt: eb.ref('excluded.submittedAt'),
      })),
    )
    .executeTakeFirst()
}

export async function upsertPullRequestReviewers(
  organizationId: OrganizationId,
  repositoryId: string,
  pullRequestNumber: number,
  reviewers: string[],
) {
  const tenantDb = getTenantDb(organizationId)
  await tenantDb.transaction().execute(async (trx) => {
    // 既存のレビュー依頼を削除してから再挿入（スナップショット方式）
    await trx
      .deleteFrom('pullRequestReviewers')
      .where('repositoryId', '=', repositoryId)
      .where('pullRequestNumber', '=', pullRequestNumber)
      .execute()

    const uniqueReviewers = [...new Set(reviewers)]
    if (uniqueReviewers.length === 0) return

    await trx
      .insertInto('pullRequestReviewers')
      .values(
        uniqueReviewers.map((reviewer) => ({
          pullRequestNumber,
          repositoryId,
          reviewer,
          requestedAt: null,
        })),
      )
      .execute()
  })
}
