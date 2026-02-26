import { jsonArrayFrom } from 'kysely/helpers/sqlite'
import { getTenantDb } from '~/app/services/tenant-db.server'

export const getIntegration = async (organizationId: string) => {
  const tenantDb = getTenantDb(organizationId)
  return await tenantDb
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
    .executeTakeFirst()
}

export const listRepositories = async (organizationId: string) => {
  const tenantDb = getTenantDb(organizationId)
  return await tenantDb.selectFrom('repositories').selectAll().execute()
}
