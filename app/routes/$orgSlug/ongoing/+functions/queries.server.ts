import { pipe, sortBy } from 'remeda'
import { calculateBusinessHours } from '~/app/libs/business-hours'
import dayjs from '~/app/libs/dayjs'
import { getTenantDb } from '~/app/services/tenant-db.server'
import type { OrganizationId } from '~/app/types/organization'

export const getOngoingPullRequestReport = async (
  organizationId: OrganizationId,
  fromDateTime: string | null,
  toDateTime: string | null,
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
      qb.where('pullRequestCreatedAt', '>=', fromDateTime),
    )
    .$if(toDateTime !== null, (qb) =>
      qb.where('pullRequestCreatedAt', '<=', toDateTime),
    )
    .$if(teamId != null, (qb) =>
      qb.where('repositories.teamId', '=', teamId as string),
    )
    .where('mergedAt', 'is', null)
    .where('state', '=', 'open')
    .orderBy('pullRequestCreatedAt', 'desc')
    .select([
      'pullRequests.author',
      'pullRequests.repo',
      'pullRequests.number',
      'pullRequests.title',
      'pullRequests.url',
      'pullRequests.firstCommittedAt',
      'pullRequests.pullRequestCreatedAt',
      'pullRequests.firstReviewedAt',
      'companyGithubUsers.displayName as authorDisplayName',
      'pullRequests.complexity',
    ])
    .execute()

  const now = new Date().toISOString()

  return pipe(
    pullrequests.map((pr) => {
      const startDate = pr.firstCommittedAt ?? pr.pullRequestCreatedAt
      const diffHours = businessDaysOnly
        ? calculateBusinessHours(startDate, now)
        : dayjs(now).diff(dayjs(startDate), 'hour', true)
      return {
        ...pr,
        createAndNowDiff: diffHours / 24,
      }
    }),
    sortBy((pr) => (pr.createAndNowDiff ? -pr.createAndNowDiff : 0)),
  )
}
