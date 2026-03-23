import { db } from '~/app/services/db.server'
import { getTenantDb } from '~/app/services/tenant-db.server'
import type { OrganizationId } from '~/app/types/organization'

export const getIntegration = async (organizationId: OrganizationId) => {
  const tenantDb = getTenantDb(organizationId)
  const [integration, repositories] = await Promise.all([
    db
      .selectFrom('integrations')
      .select(['privateToken', 'id', 'method', 'provider'])
      .where('organizationId', '=', organizationId)
      .executeTakeFirst(),
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
