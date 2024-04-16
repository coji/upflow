import { db } from '~/app/services/db.server'

export const listCompanyUsers = async (companyId: string) => {
  return await db
    .selectFrom('company_users')
    .innerJoin('users', 'company_users.user_id', 'users.id')
    .selectAll()
    .where('company_id', '==', companyId)
    .orderBy('created_at', 'asc')
    .execute()
}
