import { pipe, sortBy } from 'remeda'
import { db, type DB } from '~/app/services/db.server'
import { calculateBusinessHours } from './utils'

export const getOngoingPullRequestReport = async (
  organizationId: DB.Organization['id'],
  fromDateTime: string | null,
  toDateTime: string | null,
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
      qb.where('pullRequestCreatedAt', '>=', fromDateTime),
    )
    .$if(toDateTime !== null, (qb) =>
      qb.where('pullRequestCreatedAt', '<=', toDateTime),
    )
    .where('mergedAt', 'is', null)
    .where('state', '==', 'open')
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
