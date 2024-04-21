import { db, type DB, type Selectable } from '~/app/services/db.server'

export type Team = Selectable<DB.Team>

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

export const listTeamUsers = async (teamId: DB.Team['id']) => {
  return await db
    .selectFrom('teamUsers')
    .innerJoin('users', 'teamUsers.userId', 'users.id')
    .select([
      'users.id as id',
      'users.displayName as displayName',
      'users.pictureUrl as pictureUrl',
      'teamUsers.role as role',
    ])
    .where('teamId', '==', teamId)
    .execute()
}

export const listTeamRepositories = async (teamId: DB.Team['id']) => {
  return await db
    .selectFrom('teamRepositories')
    .selectAll()
    .where('teamId', '==', teamId)
    .execute()
}
