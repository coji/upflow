import { db, type DB } from '~/app/services/db.server'

export const listCompanyTeams = async (companyId: DB.Company['id']) => {
  return await db
    .selectFrom('teams')
    .leftJoin('team_users', 'team_users.team_id', 'teams.id')
    .leftJoin('team_repositories', 'team_repositories.team_id', 'teams.id')
    .select([
      'teams.id',
      'teams.name',
      ({ fn }) => fn.count<number>('user_id').distinct().as('user_count'),
      ({ fn }) =>
        fn.count<number>('repository_id').distinct().as('repository_count'),
    ])
    .where('company_id', '==', companyId)
    .groupBy('teams.id')
    .execute()
}
