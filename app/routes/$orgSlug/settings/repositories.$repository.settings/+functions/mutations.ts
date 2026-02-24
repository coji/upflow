import { db, type DB, type Updateable } from '~/app/services/db.server'

export const updateRepository = (
  repositoryId: DB.Repositories['id'],
  organizationId: DB.Repositories['organizationId'],
  data: Pick<
    Updateable<DB.Repositories>,
    'owner' | 'repo' | 'releaseDetectionMethod' | 'releaseDetectionKey'
  >,
) => {
  return db
    .updateTable('repositories')
    .where('id', '=', repositoryId)
    .where('organizationId', '=', organizationId)
    .set(data)
    .executeTakeFirst()
}
