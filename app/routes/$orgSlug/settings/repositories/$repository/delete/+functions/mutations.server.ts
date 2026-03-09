import { getTenantDb } from '~/app/services/tenant-db.server'
import type { OrganizationId } from '~/app/types/organization'

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
