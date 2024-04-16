import { db } from '~/app/services/db.server'

export const listCompanies = async () => {
  return await db
    .selectFrom('companies')
    .select(['companies.id', 'companies.name'])
    .execute()
}
