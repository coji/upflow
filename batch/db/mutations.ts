import { db, type DB, type Insertable } from '~/app/services/db.server'
import { timeFormatUTC } from '../helper/timeformat'

export function upsertPullRequest(data: Insertable<DB.PullRequests>) {
  const firstCommittedAt = timeFormatUTC(data.firstCommittedAt)
  const pullRequestCreatedAt = timeFormatUTC(data.pullRequestCreatedAt)
  const firstReviewedAt = timeFormatUTC(data.firstReviewedAt)
  const mergedAt = timeFormatUTC(data.mergedAt)
  const releasedAt = timeFormatUTC(data.releasedAt)
  const updatedAt = timeFormatUTC(data.updatedAt)

  return db
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
  data: Insertable<DB.PullRequestReviews>,
) {
  return db
    .insertInto('pullRequestReviews')
    .values(data)
    .onConflict((oc) =>
      oc
        .columns([
          'pullRequestNumber',
          'repositoryId',
          'reviewer',
          'submittedAt',
        ])
        .doUpdateSet((eb) => ({
          id: eb.ref('excluded.id'),
          state: eb.ref('excluded.state'),
          url: eb.ref('excluded.url'),
        })),
    )
    .executeTakeFirst()
}

export async function upsertPullRequestReviewers(
  repositoryId: string,
  pullRequestNumber: number,
  reviewers: string[],
) {
  // 既存のレビュー依頼を削除してから再挿入（スナップショット方式）
  await db
    .deleteFrom('pullRequestReviewers')
    .where('repositoryId', '=', repositoryId)
    .where('pullRequestNumber', '=', pullRequestNumber)
    .execute()

  if (reviewers.length === 0) return

  await db
    .insertInto('pullRequestReviewers')
    .values(
      reviewers.map((reviewer) => ({
        pullRequestNumber,
        repositoryId,
        reviewer,
        requestedAt: null,
      })),
    )
    .execute()
}
