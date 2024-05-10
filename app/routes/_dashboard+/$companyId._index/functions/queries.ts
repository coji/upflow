import { pipe, sortBy } from 'remeda'
import { db, type DB } from '~/app/services/db.server'
import { calculateBusinessHours } from './utils'

export const getMergedPullRequestReport = async (
  companyId: DB.Company['id'],
  fromDateTime: string | null,
  toDateTime: string | null,
) => {
  const pullrequests = await db
    .selectFrom('pullRequests')
    .innerJoin('repositories', 'pullRequests.repositoryId', 'repositories.id')
    .where('repositories.companyId', '==', companyId)
    .$if(fromDateTime !== null, (qb) =>
      qb.where('mergedAt', '>=', fromDateTime),
    )
    .$if(toDateTime !== null, (qb) => qb.where('mergedAt', '<=', toDateTime))
    .where('author', 'not like', '%[bot]')
    .orderBy('mergedAt', 'desc')
    .orderBy('pullRequestCreatedAt', 'desc')
    .selectAll('pullRequests')
    .execute()

  return pipe(
    pullrequests.map((pr) => {
      return {
        ...pr,
        createAndMergeDiff: pr.mergedAt
          ? // 最初のコミットからマージまでの日数を計算
            calculateBusinessHours(
              pr.firstCommittedAt ?? pr.pullRequestCreatedAt,
              pr.mergedAt,
            ) / 24
          : null,
      }
    }),
    sortBy((pr) => (pr.createAndMergeDiff ? -pr.createAndMergeDiff : 0)),
  )
}
