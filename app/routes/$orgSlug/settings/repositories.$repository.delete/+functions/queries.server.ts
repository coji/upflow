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
