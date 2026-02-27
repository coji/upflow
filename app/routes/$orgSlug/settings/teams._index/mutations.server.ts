import {
  getTenantDb,
  type OrganizationId,
} from '~/app/services/tenant-db.server'

export const addTeam = async (params: {
  organizationId: OrganizationId
  name: string
  displayOrder: number
}) => {
  const tenantDb = getTenantDb(params.organizationId)
  await tenantDb
    .insertInto('teams')
    .values({
      id: crypto.randomUUID(),
      name: params.name,
      displayOrder: params.displayOrder,
    })
    .execute()
}

export const updateTeam = async (params: {
  organizationId: OrganizationId
  id: string
  name: string
  displayOrder: number
}) => {
  const tenantDb = getTenantDb(params.organizationId)
  await tenantDb
    .updateTable('teams')
    .set({
      name: params.name,
      displayOrder: params.displayOrder,
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
