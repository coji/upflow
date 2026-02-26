import {
  getTenantDb,
  type OrganizationId,
} from '~/app/services/tenant-db.server'

export const addGithubUser = async (params: {
  login: string
  displayName: string
  organizationId: OrganizationId
}) => {
  const tenantDb = getTenantDb(params.organizationId)
  await tenantDb
    .insertInto('companyGithubUsers')
    .values({
      login: params.login,
      displayName: params.displayName,
      updatedAt: new Date().toISOString(),
    })
    .execute()
}

export const updateGithubUser = async (params: {
  login: string
  organizationId: OrganizationId
  displayName: string
  name: string | null
  email: string | null
}) => {
  const tenantDb = getTenantDb(params.organizationId)
  await tenantDb
    .updateTable('companyGithubUsers')
    .set({
      displayName: params.displayName,
      name: params.name,
      email: params.email,
      updatedAt: new Date().toISOString(),
    })
    .where('login', '=', params.login)
    .execute()
}

export const deleteGithubUser = async (
  login: string,
  organizationId: OrganizationId,
) => {
  const tenantDb = getTenantDb(organizationId)
  await tenantDb
    .deleteFrom('companyGithubUsers')
    .where('login', '=', login)
    .execute()
}
