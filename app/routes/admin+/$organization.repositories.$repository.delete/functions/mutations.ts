import { db, type DB } from '~/app/services/db.server'

export const deleteRepository = (repositoryId: DB.Repositories['id']) => {
  return db.deleteFrom('repositories').where('id', '=', repositoryId).execute()
}
