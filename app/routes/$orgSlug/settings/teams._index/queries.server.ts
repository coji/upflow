import { getTenantDb } from '~/app/services/tenant-db.server'
import type { OrganizationId } from '~/app/types/organization'

export const listTeams = (organizationId: OrganizationId) => {
  const tenantDb = getTenantDb(organizationId)
  return tenantDb
    .selectFrom('teams')
    .selectAll()
    .orderBy('displayOrder', 'asc')
    .orderBy('name', 'asc')
    .execute()
}

export type TeamRow = Awaited<ReturnType<typeof listTeams>>[number]
