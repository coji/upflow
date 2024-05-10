import { db, type DB } from '~/app/services/db.server'

export const getTeam = async (
  companyId: DB.Team['companyId'],
  teamId: DB.Team['id'],
) => {
  return await db
    .selectFrom('teams')
    .selectAll()
    .where('companyId', '==', companyId)
    .where('id', '==', teamId)
    .executeTakeFirst()
}
