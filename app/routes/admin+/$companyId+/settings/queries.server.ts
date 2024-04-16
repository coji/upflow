import { db, type DB, type Updateable } from '~/app/services/db.server'

export const getCompany = async (companyId: DB.Company['id']) => {
  return await db
    .selectFrom('companies')
    .selectAll()
    .where('id', '==', companyId)
    .executeTakeFirst()
}

export const updateCompany = async (
  companyId: DB.Company['id'],
  data: Updateable<DB.Company>,
) => {
  console.log({ data })
  return await db
    .updateTable('companies')
    .where('id', '==', companyId)
    .set({ ...data, updated_at: new Date().toISOString() })
    .execute()
}
