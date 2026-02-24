import { db, type DB } from '~/app/services/db.server'

export const deleteRepository = (
  repositoryId: DB.Repositories['id'],
  organizationId: DB.Repositories['organizationId'],
) => {
  return db
    .deleteFrom('repositories')
    .where('id', '=', repositoryId)
    .where('organizationId', '=', organizationId)
    .execute()
}
