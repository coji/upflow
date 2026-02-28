import { db } from '~/app/services/db.server'
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
      isActive: 1,
      updatedAt: new Date().toISOString(),
    })
    .onConflict((oc) =>
      oc.column('login').doUpdateSet({
        displayName: params.displayName,
        isActive: 1,
        updatedAt: new Date().toISOString(),
      }),
    )
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

  // Revoke all sessions for the user before deleting
  const row = await tenantDb
    .selectFrom('companyGithubUsers')
    .select('userId')
    .where('login', '=', login)
    .executeTakeFirst()

  if (row?.userId) {
    await db.deleteFrom('sessions').where('userId', '=', row.userId).execute()
  }

  await tenantDb
    .deleteFrom('companyGithubUsers')
    .where('login', '=', login)
    .execute()
}

export const toggleGithubUserActive = async (params: {
  login: string
  isActive: 0 | 1
  organizationId: OrganizationId
}) => {
  const tenantDb = getTenantDb(params.organizationId)

  // When deactivating, revoke all sessions for the user immediately
  if (params.isActive === 0) {
    const row = await tenantDb
      .selectFrom('companyGithubUsers')
      .select('userId')
      .where('login', '=', params.login)
      .executeTakeFirst()

    if (row?.userId) {
      await db.deleteFrom('sessions').where('userId', '=', row.userId).execute()
    }
  }

  await tenantDb
    .updateTable('companyGithubUsers')
    .set({
      isActive: params.isActive,
      updatedAt: new Date().toISOString(),
    })
    .where('login', '=', params.login)
    .execute()
}
