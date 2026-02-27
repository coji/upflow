import {
  getTenantDb,
  type OrganizationId,
} from '~/app/services/tenant-db.server'

export const updateRepositoryTeam = async (
  organizationId: OrganizationId,
  repositoryId: string,
  teamId: string | null,
) => {
  const tenantDb = getTenantDb(organizationId)
  await tenantDb
    .updateTable('repositories')
    .set({ teamId })
    .where('id', '=', repositoryId)
    .execute()
}
