import { pipe, sortBy } from 'remeda'
import { db, type DB } from '~/app/services/db.server'
import { calculateBusinessHours } from './utils'

export const getMergedPullRequestReport = async (
  organizationId: DB.Organizations['id'],
  fromDateTime: string | null,
  toDateTime: string | null,
  objective: number,
) => {
  const pullrequests = await db
    .selectFrom('pullRequests')
    .innerJoin('repositories', 'pullRequests.repositoryId', 'repositories.id')
    .leftJoin(
      'companyGithubUsers',
      'pullRequests.author',
      'companyGithubUsers.login',
    )
    .where('repositories.organizationId', '=', organizationId)
    .$if(fromDateTime !== null, (qb) =>
      qb.where('mergedAt', '>=', fromDateTime),
    )
    .$if(toDateTime !== null, (qb) => qb.where('mergedAt', '<=', toDateTime))
    .where('author', 'not like', '%[bot]')
    .orderBy('mergedAt', 'desc')
    .orderBy('pullRequestCreatedAt', 'desc')
    .selectAll('pullRequests')
    .select('companyGithubUsers.displayName as authorDisplayName')
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
