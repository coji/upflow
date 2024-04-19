import { db } from '~/app/services/db.server'

export const getCompany = async (companyId: string) => {
  return await db
    .selectFrom('companies')
    .where('companies.id', '==', companyId)
    .selectAll()
    .executeTakeFirst()
}
