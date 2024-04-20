import { db, type DB } from '~/app/services/db.server'

export const getIntegration = async (companyId: DB.Company['id']) => {
  return await db
    .selectFrom('integrations')
    .selectAll()
    .where('companyId', '==', companyId)
    .executeTakeFirst()
}
