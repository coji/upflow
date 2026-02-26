import { getTenantDb } from '~/app/services/tenant-db.server'

export const getRepository = async (
  organizationId: string,
  repositoryId: string,
) => {
  const tenantDb = getTenantDb(organizationId)
  return await tenantDb
    .selectFrom('repositories')
    .selectAll()
    .where('id', '=', repositoryId)
    .executeTakeFirst()
}

export const getIntegration = async (organizationId: string) => {
  const tenantDb = getTenantDb(organizationId)
  return await tenantDb
    .selectFrom('integrations')
    .selectAll()
    .executeTakeFirst()
}
