import { pipe, sortBy } from 'remeda'
import { diffInDays } from '~/app/libs/business-hours'
import { excludeBots } from '~/app/libs/tenant-query.server'
import { getTenantDb } from '~/app/services/tenant-db.server'
import type { OrganizationId } from '~/app/types/organization'

export const getMergedPullRequestReport = async (
  organizationId: OrganizationId,
  fromDateTime: string | null,
  toDateTime: string | null,
  objective: number,
  teamId?: string | null,
  businessDaysOnly = true,
) => {
  const tenantDb = getTenantDb(organizationId)
  const pullrequests = await tenantDb
    .selectFrom('pullRequests')
    .innerJoin('repositories', 'pullRequests.repositoryId', 'repositories.id')
    .leftJoin('companyGithubUsers', (join) =>
      join.onRef(
        (eb) => eb.fn('lower', ['pullRequests.author']),
        '=',
        (eb) => eb.fn('lower', ['companyGithubUsers.login']),
      ),
    )
    .$if(fromDateTime !== null, (qb) =>
      qb.where('mergedAt', '>=', fromDateTime),
    )
    .$if(toDateTime !== null, (qb) => qb.where('mergedAt', '<=', toDateTime))
    .$if(teamId != null, (qb) =>
      qb.where('repositories.teamId', '=', teamId as string),
    )
    .where(excludeBots)
    .leftJoin('pullRequestFeedbacks', (join) =>
      join
        .onRef(
          'pullRequestFeedbacks.pullRequestNumber',
          '=',
          'pullRequests.number',
        )
        .onRef(
          'pullRequestFeedbacks.repositoryId',
          '=',
          'pullRequests.repositoryId',
        ),
    )
    .select([
      'pullRequests.author',
      'pullRequests.repo',
      'pullRequests.number',
      'pullRequests.repositoryId',
      'pullRequests.title',
      'pullRequests.url',
      'pullRequests.firstCommittedAt',
      'pullRequests.pullRequestCreatedAt',
      'pullRequests.firstReviewedAt',
      'pullRequests.mergedAt',
      'companyGithubUsers.displayName as authorDisplayName',
      'pullRequests.complexity',
      'pullRequests.complexityReason',
      'pullRequests.riskAreas',
      'pullRequestFeedbacks.correctedComplexity',
      'pullRequestFeedbacks.reason',
      'pullRequestFeedbacks.feedbackBy',
      'pullRequestFeedbacks.feedbackByLogin',
      'pullRequestFeedbacks.updatedAt as feedbackAt',
    ])
    .execute()

  return pipe(
    pullrequests.map((pr) => {
      const createAndMergeDiff = pr.mergedAt
        ? diffInDays(
            pr.firstCommittedAt ?? pr.pullRequestCreatedAt,
            pr.mergedAt,
            businessDaysOnly,
          )
        : null
      const achievement =
        createAndMergeDiff !== null ? createAndMergeDiff < objective : false
      return {
        ...pr,
        createAndMergeDiff,
        achievement,
      }
    }),
    sortBy((pr) => (pr.createAndMergeDiff ? -pr.createAndMergeDiff : 0)),
  )
}
