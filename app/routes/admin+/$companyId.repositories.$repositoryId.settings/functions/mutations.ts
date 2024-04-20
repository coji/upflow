import { db, type DB, type Updateable } from '~/app/services/db.server'

export const updateRepository = (
  repositoryId: DB.Repository['id'],
  data: Updateable<DB.Repository>,
) => {
  return db
    .updateTable('repositories')
    .where('id', '==', repositoryId)
    .set(data)
    .executeTakeFirst()
}
