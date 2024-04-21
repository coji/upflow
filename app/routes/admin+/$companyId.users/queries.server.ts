import { db, type DB } from '~/app/services/db.server'

export const listCompanyUsers = async (companyId: DB.Company['id']) => {
  return await db
    .selectFrom('companyUsers')
    .selectAll()
    .where('companyId', '==', companyId)
    .execute()
}
