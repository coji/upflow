import { getTenantDb } from '~/app/services/tenant-db.server'

export const deleteRepository = (
  organizationId: string,
  repositoryId: string,
) => {
  const tenantDb = getTenantDb(organizationId)
  return tenantDb
    .deleteFrom('repositories')
    .where('id', '=', repositoryId)
    .execute()
}
