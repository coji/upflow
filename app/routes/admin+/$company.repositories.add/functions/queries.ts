import { jsonArrayFrom } from 'kysely/helpers/sqlite'
import { db, type DB } from '~/app/services/db.server'

export const getIntegration = async (companyId: DB.Company['id']) => {
  return await db
    .selectFrom('integrations')
    .select((eb) => [
      'privateToken',
      jsonArrayFrom(
        eb
          .selectFrom('repositories')
          .select([
            'repositories.id',
            'repositories.owner',
            'repositories.repo',
          ]),
      ).as('repositories'),
    ])
    .where('companyId', '==', companyId)
    .executeTakeFirst()
}

export const listRepositories = async (companyId: DB.Company['id']) => {
  return await db
    .selectFrom('repositories')
    .selectAll()
    .where('repositories.companyId', '==', companyId)
    .execute()
}
