import {
  db,
  type DB,
  type Insertable,
  type Updateable,
} from '~/app/services/db.server'

export const updateCompany = async (
  id: DB.Company['id'],
  data: Updateable<DB.Company>,
) => {
  return await db
    .updateTable('companies')
    .where('id', '==', id)
    .set({ ...data, updated_at: new Date().toISOString() })
    .execute()
}

export const getIntegration = async (companyId: DB.Company['id']) => {
  return await db
    .selectFrom('integrations')
    .selectAll()
    .where('company_id', '==', companyId)
    .executeTakeFirst()
}

export const createIntegration = async (data: Insertable<DB.Integration>) => {
  return await db.insertInto('integrations').values(data).execute()
}
