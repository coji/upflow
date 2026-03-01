import {
  getTenantDb,
  type OrganizationId,
} from '~/app/services/tenant-db.server'

export const getIntegration = async (organizationId: OrganizationId) => {
  const tenantDb = getTenantDb(organizationId)
  return await tenantDb
    .selectFrom('integrations')
    .selectAll()
    .executeTakeFirst()
}
