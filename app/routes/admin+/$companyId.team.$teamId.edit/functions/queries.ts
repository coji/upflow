import { db, type DB } from '~/app/services/db.server'

export const getTeam = async (
  companyId: DB.Team['company_id'],
  teamId: DB.Team['id'],
) => {
  return await db
    .selectFrom('teams')
    .selectAll()
    .where('company_id', '==', companyId)
    .where('id', '==', teamId)
    .executeTakeFirst()
}
