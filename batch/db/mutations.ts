import { db, type DB, type Insertable } from '~/app/services/db.server'

export function upsertPullRequest(data: Insertable<DB.PullRequest>) {
  return db
    .insertInto('pullRequests')
    .values(data)
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
      })),
    )
    .executeTakeFirst()
}
