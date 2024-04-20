import { db } from '~/app/services/db.server'

export const listUserCompanies = async (userId: string) => {
  const teams = await db
    .selectFrom('companies')
    .select(['id', 'name'])
    .orderBy('companies.createdAt')
    .execute()
  return teams
}
