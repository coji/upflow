import { db, type DB, type Updateable } from '~/app/services/db.server'

export const updateRepository = (
  repositoryId: DB.Repositories['id'],
  data: Updateable<DB.Repositories>,
) => {
  return db
    .updateTable('repositories')
    .where('id', '=', repositoryId)
    .set(data)
    .executeTakeFirst()
}
