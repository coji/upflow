import { db, type DB } from '~/app/services/db.server'

export const listRepositories = async (
  organizationId: DB.Organization['id'],
) => {
  return await db
    .selectFrom('repositories')
    .selectAll()
    .where('repositories.organizationId', '=', organizationId)
    .execute()
}
