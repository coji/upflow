import {
  getTenantDb,
  type OrganizationId,
} from '~/app/services/tenant-db.server'

export const deleteRepository = (
  organizationId: OrganizationId,
  repositoryId: string,
) => {
  const tenantDb = getTenantDb(organizationId)
  return tenantDb
    .deleteFrom('repositories')
    .where('id', '=', repositoryId)
    .execute()
}
