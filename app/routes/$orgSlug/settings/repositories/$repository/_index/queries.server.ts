import {
  getTenantDb,
  type OrganizationId,
} from '~/app/services/tenant-db.server'

export const listPullRequests = async (
  organizationId: OrganizationId,
  repositoryId: string,
) => {
  const tenantDb = getTenantDb(organizationId)
  return await tenantDb
    .selectFrom('pullRequests')
    .where('repositoryId', '=', repositoryId)
    .orderBy('number', 'desc')
    .selectAll()
    .execute()
}
