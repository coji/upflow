import { db, type DB } from '~/app/services/db.server'

export const getRepository = async (repositoryId: DB.Repositories['id']) => {
  return await db
    .selectFrom('repositories')
    .where('id', '==', repositoryId)
    .selectAll()
    .executeTakeFirst()
}

export const listPullRequests = async (repositoryId: DB.Repositories['id']) => {
  return await db
    .selectFrom('pullRequests')
    .where('repositoryId', '==', repositoryId)
    .orderBy('number', 'desc')
    .selectAll()
    .execute()
}
