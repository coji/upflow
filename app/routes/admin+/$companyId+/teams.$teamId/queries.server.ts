import { db, type DB, type Selectable } from '~/app/services/db.server'

export type Team = Selectable<DB.Team>

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

export const listTeamUsers = async (teamId: DB.Team['id']) => {
  return await db
    .selectFrom('team_users')
    .innerJoin('users', 'team_users.user_id', 'users.id')
    .select([
      'users.id as id',
      'users.display_name as display_name',
      'users.picture_url as picture_url',
      'team_users.role as role',
    ])
    .where('team_id', '==', teamId)
    .execute()
}

export const listTeamRepositories = async (teamId: DB.Team['id']) => {
  return await db
    .selectFrom('team_repositories')
    .selectAll()
    .where('team_id', '==', teamId)
    .execute()
}
