import { db, type DB } from '~/app/services/db.server'

export const getRepository = async (repositoryId: DB.Repository['id']) => {
  return await db
    .selectFrom('repositories')
    .selectAll()
    .where('id', '=', repositoryId)
    .executeTakeFirst()
}
