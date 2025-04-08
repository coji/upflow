import { jsonObjectFrom } from 'kysely/helpers/sqlite'
import { db, type DB } from '~/app/services/db.server'

export const getRepository = async (repositoryId: DB.Repository['id']) => {
  return await db
    .selectFrom('repositories')
    .where('id', '==', repositoryId)
    .select((eb) => [
      'id',
      'owner',
      'repo',
      jsonObjectFrom(
        eb
          .selectFrom('integrations')
          .select(['privateToken'])
          .whereRef('integrations.id', '==', 'repositories.integrationId'),
      ).as('integration'),
    ])
    .executeTakeFirst()
}

export const getPullRequest = async (
  repositoryId: DB.Repository['id'],
  number: DB.PullRequest['number'],
) => {
  return await db
    .selectFrom('pullRequests')
    .where('repositoryId', '==', repositoryId)
    .where('number', '==', number)
    .selectAll()
    .executeTakeFirst()
}
