import { db, type DB } from '~/app/services/db.server'

export const listCompanyTeams = async (companyId: DB.Company['id']) => {
  return await db
    .selectFrom('teams')
    .leftJoin('teamUsers', 'teamUsers.teamId', 'teams.id')
    .leftJoin('teamRepositories', 'teamRepositories.teamId', 'teams.id')
    .select([
      'teams.id',
      'teams.name',
      ({ fn }) => fn.count<number>('userId').distinct().as('userCount'),
      ({ fn }) =>
        fn.count<number>('repositoryId').distinct().as('repositoryCount'),
    ])
    .where('companyId', '==', companyId)
    .groupBy('teams.id')
    .execute()
}
