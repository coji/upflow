import { db, type DB } from '~/app/services/db.server'

export const listRepositories = async (companyId: DB.Company['id']) => {
  return await db
    .selectFrom('repositories')
    .selectAll()
    .where('repositories.company_id', '==', companyId)
    .execute()
}
