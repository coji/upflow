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
    .where('id', '=', repositoryId)
    .selectAll()
    .executeTakeFirst()
}

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
