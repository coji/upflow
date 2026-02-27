import { pipe, sortBy } from 'remeda'
import {
  getTenantDb,
  type OrganizationId,
} from '~/app/services/tenant-db.server'
import { calculateBusinessHours } from './utils'

export const getOngoingPullRequestReport = async (
  organizationId: OrganizationId,
  fromDateTime: string | null,
  toDateTime: string | null,
  teamId?: string | null,
) => {
  const tenantDb = getTenantDb(organizationId)
  const pullrequests = await tenantDb
    .selectFrom('pullRequests')
    .innerJoin('repositories', 'pullRequests.repositoryId', 'repositories.id')
    .leftJoin(
      'companyGithubUsers',
      'pullRequests.author',
      'companyGithubUsers.login',
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
    .where('author', 'not like', '%[bot]')
    .orderBy('pullRequestCreatedAt', 'desc')
    .selectAll('pullRequests')
    .select('companyGithubUsers.displayName as authorDisplayName')
    .execute()

  return pipe(
    pullrequests.map((pr) => {
      return {
        ...pr,
        createAndNowDiff:
          calculateBusinessHours(
            pr.pullRequestCreatedAt,
            new Date().toISOString(),
          ) / 24, // 作成日からの経過時間（営業時間のみカウント）
      }
    }),
    sortBy((pr) => (pr.createAndNowDiff ? -pr.createAndNowDiff : 0)),
  )
}
