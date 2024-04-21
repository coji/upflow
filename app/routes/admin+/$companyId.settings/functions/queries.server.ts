import { db, type DB } from '~/app/services/db.server'

export const getCompany = async (companyId: DB.Company['id']) => {
  return await db
    .selectFrom('companies')
    .selectAll()
    .where('id', '==', companyId)
    .executeTakeFirst()
}

export const getExportSetting = async (companyId: DB.Company['id']) => {
  return await db
    .selectFrom('exportSettings')
    .selectAll()
    .where('companyId', '==', companyId)
    .executeTakeFirst()
}

export const getIntegration = async (companyId: DB.Company['id']) => {
  return await db
    .selectFrom('integrations')
    .selectAll()
    .where('companyId', '==', companyId)
    .executeTakeFirst()
}
