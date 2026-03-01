import { pipe, sortBy } from 'remeda'
import {
  getTenantDb,
  type OrganizationId,
} from '~/app/services/tenant-db.server'
import { calculateBusinessHours } from './utils'

export const getMergedPullRequestReport = async (
  organizationId: OrganizationId,
  fromDateTime: string | null,
  toDateTime: string | null,
  objective: number,
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
      qb.where('mergedAt', '>=', fromDateTime),
    )
    .$if(toDateTime !== null, (qb) => qb.where('mergedAt', '<=', toDateTime))
    .$if(teamId != null, (qb) =>
      qb.where('repositories.teamId', '=', teamId as string),
    )
    .where('author', 'not like', '%[bot]')
    .orderBy('mergedAt', 'desc')
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
      'pullRequests.mergedAt',
      'companyGithubUsers.displayName as authorDisplayName',
    ])
    .execute()

  return pipe(
    pullrequests.map((pr) => {
      const createAndMergeDiff = pr.mergedAt
        ? // 最初のコミットからマージまでの日数を計算
          calculateBusinessHours(
            pr.firstCommittedAt ?? pr.pullRequestCreatedAt,
            pr.mergedAt,
          ) / 24
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
