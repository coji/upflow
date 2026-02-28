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
      isActive: 0,
      updatedAt: new Date().toISOString(),
    })
    .onConflict((oc) =>
      oc.column('login').doUpdateSet({
        displayName: params.displayName,
        updatedAt: new Date().toISOString(),
      }),
    )
    .execute()
}

export const updateGithubUser = async (params: {
  login: string
  organizationId: OrganizationId
  displayName: string
}) => {
  const tenantDb = getTenantDb(params.organizationId)
  await tenantDb
    .updateTable('companyGithubUsers')
    .set({
      displayName: params.displayName,
      updatedAt: new Date().toISOString(),
    })
    .where('login', '=', params.login)
    .execute()
}

export const deleteGithubUser = async (
  login: string,
  organizationId: OrganizationId,
  currentUserId: string,
) => {
  const tenantDb = getTenantDb(organizationId)

  const row = await tenantDb
    .selectFrom('companyGithubUsers')
    .select('userId')
    .where('login', '=', login)
    .executeTakeFirst()

  if (row?.userId === currentUserId) {
    throw new Error('Cannot delete yourself')
  }

  // Revoke all sessions for the user before deleting
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
  currentUserId: string
}) => {
  const tenantDb = getTenantDb(params.organizationId)

  // When deactivating, check if the target is the current user
  if (params.isActive === 0) {
    const row = await tenantDb
      .selectFrom('companyGithubUsers')
      .select('userId')
      .where('login', '=', params.login)
      .executeTakeFirst()

    if (row?.userId === params.currentUserId) {
      throw new Error('Cannot deactivate yourself')
    }

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
