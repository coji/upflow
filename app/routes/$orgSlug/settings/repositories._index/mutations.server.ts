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
  const result = await tenantDb
    .updateTable('repositories')
    .set({ teamId })
    .where('id', '=', repositoryId)
    .executeTakeFirst()

  if (Number(result.numUpdatedRows ?? 0) !== 1) {
    throw new Error('Repository not found')
  }
}

export const bulkUpdateRepositoryTeam = async (
  organizationId: OrganizationId,
  repositoryIds: string[],
  teamId: string | null,
) => {
  const tenantDb = getTenantDb(organizationId)
  await tenantDb
    .updateTable('repositories')
    .set({ teamId })
    .where('id', 'in', repositoryIds)
    .execute()
}
