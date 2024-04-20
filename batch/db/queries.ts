import { db, type DB } from '~/app/services/db.server'

export const getPullRequestReport = async (companyId: DB.Company['id']) => {
  return await db
    .selectFrom('pullRequests')
    .innerJoin('repositories', 'pullRequests.repositoryId', 'repositories.id')
    .where('repositories.companyId', '==', companyId)
    .orderBy('mergedAt', 'desc')
    .selectAll('pullRequests')
    .execute()
}
