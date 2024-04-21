import { db } from '~/app/services/db.server'

export const getCompany = async (companyId: string) => {
  return await db
    .selectFrom('companies')
    .select(['id', 'name'])
    .where('id', '==', companyId)
    .executeTakeFirst()
}
