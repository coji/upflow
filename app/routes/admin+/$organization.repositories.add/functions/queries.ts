import { jsonArrayFrom } from 'kysely/helpers/sqlite'
import { db, type DB } from '~/app/services/db.server'

export const getIntegration = async (
  organizationId: DB.Organizations['id'],
) => {
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
    .where('organizationId', '=', organizationId)
    .executeTakeFirst()
}

export const listRepositories = async (
  organizationId: DB.Organizations['id'],
) => {
  return await db
    .selectFrom('repositories')
    .selectAll()
    .where('repositories.organizationId', '=', organizationId)
    .execute()
}
