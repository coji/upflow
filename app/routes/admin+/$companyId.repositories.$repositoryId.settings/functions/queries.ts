import { db, type DB } from '~/app/services/db.server'

export const getRepository = async (repositoryId: DB.Repository['id']) => {
  return await db
    .selectFrom('repositories')
    .selectAll()
    .where('id', '==', repositoryId)
    .executeTakeFirst()
}

export const getIntegration = async (companyId: DB.Company['id']) => {
  return await db
    .selectFrom('integrations')
    .selectAll()
    .where('integrations.companyId', '==', companyId)
    .executeTakeFirst()
}
