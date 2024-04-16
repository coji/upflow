import { db } from '~/app/services/db.server'

export const listCompanies = async () => {
  return await db.selectFrom('companies').select(['id', 'name']).execute()
}
