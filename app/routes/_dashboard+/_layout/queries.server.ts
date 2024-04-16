import { db } from '~/app/services/db.server'

export const listCompanies = async () => {
  return await db
    .selectFrom('companies')
    .innerJoin('teams', 'companies.id', 'teams.company_id')
    .select(['companies.id', 'companies.name', 'teams.id', 'teams.name'])
    .execute()
}
