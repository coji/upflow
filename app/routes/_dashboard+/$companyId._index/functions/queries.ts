import { pipe, sortBy } from 'remeda'
import dayjs from '~/app/libs/dayjs'
import { db, type DB } from '~/app/services/db.server'

export const getMergedPullRequestReport = async (
  companyId: DB.Company['id'],
  startDate: string,
) => {
  const pullrequests = await db
    .selectFrom('pullRequests')
    .innerJoin('repositories', 'pullRequests.repositoryId', 'repositories.id')
    .where('repositories.companyId', '==', companyId)
    .where('mergedAt', '>', startDate)
    .where('author', 'not like', '[bot]')
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
            dayjs(pr.mergedAt).diff(dayjs(pr.firstCommittedAt), 'hours') / 24
          : null,
      }
    }),
    sortBy((pr) => (pr.createAndMergeDiff ? -pr.createAndMergeDiff : 0)),
  )
}
