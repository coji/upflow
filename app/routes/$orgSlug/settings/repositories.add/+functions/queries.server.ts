import { getIntegration } from '~/app/services/github-integration-queries.server'
import { getTenantDb } from '~/app/services/tenant-db.server'
import type { OrganizationId } from '~/app/types/organization'

/** Integration row + tenant repositories for the add-repositories flow. */
export const getIntegrationWithRepositories = async (
  organizationId: OrganizationId,
) => {
  const tenantDb = getTenantDb(organizationId)
  const [integration, repositories] = await Promise.all([
    getIntegration(organizationId),
    tenantDb
      .selectFrom('repositories')
      .select(['id', 'owner', 'repo'])
      .execute(),
  ])
  if (!integration) return undefined
  return { ...integration, repositories }
}

export const listRepositories = async (organizationId: OrganizationId) => {
  const tenantDb = getTenantDb(organizationId)
  return await tenantDb.selectFrom('repositories').selectAll().execute()
}
