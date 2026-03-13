import { DEFAULT_PERSONAL_LIMIT } from '~/app/routes/$orgSlug/stacks/+functions/aggregate-stacks'
import { getTenantDb } from '~/app/services/tenant-db.server'
import type { OrganizationId } from '~/app/types/organization'

export const addTeam = async (params: {
  organizationId: OrganizationId
  name: string
  displayOrder: number
  personalLimit?: number
}) => {
  const tenantDb = getTenantDb(params.organizationId)
  await tenantDb
    .insertInto('teams')
    .values({
      id: crypto.randomUUID(),
      name: params.name,
      displayOrder: params.displayOrder,
      personalLimit: params.personalLimit ?? DEFAULT_PERSONAL_LIMIT,
    })
    .execute()
}

export const updateTeam = async (params: {
  organizationId: OrganizationId
  id: string
  name: string
  displayOrder: number
  personalLimit: number
}) => {
  const tenantDb = getTenantDb(params.organizationId)
  await tenantDb
    .updateTable('teams')
    .set({
      name: params.name,
      displayOrder: params.displayOrder,
      personalLimit: params.personalLimit,
    })
    .where('id', '=', params.id)
    .execute()
}

export const deleteTeam = async (
  organizationId: OrganizationId,
  id: string,
) => {
  const tenantDb = getTenantDb(organizationId)
  await tenantDb.deleteFrom('teams').where('id', '=', id).execute()
}
