import { db, type DB } from '~/app/services/db.server'

export const getRepository = async (repositoryId: DB.Repositories['id']) => {
  return await db
    .selectFrom('repositories')
    .selectAll()
    .where('id', '=', repositoryId)
    .executeTakeFirst()
}

export const getIntegration = async (
  organizationId: DB.Organizations['id'],
) => {
  return await db
    .selectFrom('integrations')
    .selectAll()
    .where('integrations.organizationId', '=', organizationId)
    .executeTakeFirst()
}
