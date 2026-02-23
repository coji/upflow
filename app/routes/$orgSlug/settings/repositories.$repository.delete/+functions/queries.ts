import { db, type DB } from '~/app/services/db.server'

export const getRepository = async (repositoryId: DB.Repositories['id']) => {
  return await db
    .selectFrom('repositories')
    .selectAll()
    .where('id', '=', repositoryId)
    .executeTakeFirst()
}
