import { pipe, sortBy } from 'remeda'
import { calculateBusinessHours } from '~/app/libs/business-hours'
import dayjs from '~/app/libs/dayjs'
import { getTenantDb } from '~/app/services/tenant-db.server'
import type { OrganizationId } from '~/app/types/organization'

export const getDeployedPullRequestReport = async (
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
    .where('pullRequests.releasedAt', 'is not', null)
    .$if(fromDateTime !== null, (qb) =>
      qb.where('releasedAt', '>=', fromDateTime),
    )
    .$if(toDateTime !== null, (qb) => qb.where('releasedAt', '<=', toDateTime))
    .$if(teamId != null, (qb) =>
      qb.where('repositories.teamId', '=', teamId as string),
    )
    .where((eb) =>
      eb.or([
        eb('companyGithubUsers.type', 'is', null),
        eb('companyGithubUsers.type', '!=', 'Bot'),
      ]),
    )
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
    .orderBy('releasedAt', 'desc')
    .orderBy('pullRequestCreatedAt', 'desc')
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
      'pullRequests.releasedAt',
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
      const createAndDeployDiff = pr.releasedAt
        ? (businessDaysOnly
            ? calculateBusinessHours(
                pr.firstCommittedAt ?? pr.pullRequestCreatedAt,
                pr.releasedAt,
              )
            : dayjs(pr.releasedAt).diff(
                dayjs(pr.firstCommittedAt ?? pr.pullRequestCreatedAt),
                'hour',
                true,
              )) / 24
        : null
      const deployTime =
        pr.mergedAt && pr.releasedAt
          ? (businessDaysOnly
              ? calculateBusinessHours(pr.mergedAt, pr.releasedAt)
              : dayjs(pr.releasedAt).diff(dayjs(pr.mergedAt), 'hour', true)) /
            24
          : null
      const achievement =
        createAndDeployDiff !== null ? createAndDeployDiff < objective : false
      return {
        ...pr,
        createAndDeployDiff,
        deployTime,
        achievement,
      }
    }),
    sortBy((pr) => (pr.createAndDeployDiff ? -pr.createAndDeployDiff : 0)),
  )
}
