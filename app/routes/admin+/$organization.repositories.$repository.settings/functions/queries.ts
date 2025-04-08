import { db, type DB } from '~/app/services/db.server'

export const getRepository = async (repositoryId: DB.Repository['id']) => {
  return await db
    .selectFrom('repositories')
    .selectAll()
    .where('id', '=', repositoryId)
    .executeTakeFirst()
}

export const getIntegration = async (organizationId: DB.Organization['id']) => {
  return await db
    .selectFrom('integrations')
    .selectAll()
    .where('integrations.organizationId', '=', organizationId)
    .executeTakeFirst()
}
