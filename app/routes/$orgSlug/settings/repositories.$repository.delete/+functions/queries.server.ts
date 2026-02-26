import {
  getTenantDb,
  type OrganizationId,
} from '~/app/services/tenant-db.server'

export const getRepository = async (
  organizationId: OrganizationId,
  repositoryId: string,
) => {
  const tenantDb = getTenantDb(organizationId)
  return await tenantDb
    .selectFrom('repositories')
    .selectAll()
    .where('id', '=', repositoryId)
    .executeTakeFirst()
}
