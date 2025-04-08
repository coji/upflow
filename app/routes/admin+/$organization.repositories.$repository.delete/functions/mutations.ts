import { db, type DB } from '~/app/services/db.server'

export const deleteRepository = (repositoryId: DB.Repository['id']) => {
  return db.deleteFrom('repositories').where('id', '=', repositoryId).execute()
}
