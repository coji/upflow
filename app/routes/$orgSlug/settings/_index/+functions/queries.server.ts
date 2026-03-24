import { db } from '~/app/services/db.server'
import { getTenantDb } from '~/app/services/tenant-db.server'
import type { OrganizationId } from '~/app/types/organization'

export const getOrganization = async (organizationId: OrganizationId) => {
  return await db
    .selectFrom('organizations')
    .selectAll()
    .where('id', '=', organizationId)
    .executeTakeFirst()
}

export const getOrganizationSetting = async (
  organizationId: OrganizationId,
) => {
  const tenantDb = getTenantDb(organizationId)
  return await tenantDb
    .selectFrom('organizationSettings')
    .selectAll()
    .executeTakeFirst()
}

export const createDefaultOrganizationSetting = async (
  organizationId: OrganizationId,
) => {
  const tenantDb = getTenantDb(organizationId)
  const id = crypto.randomUUID()
  await tenantDb
    .insertInto('organizationSettings')
    .values({
      id,
      updatedAt: new Date().toISOString(),
    })
    .onConflict((oc) => oc.doNothing())
    .execute()
  const row = await getOrganizationSetting(organizationId)
  if (!row) throw new Error('Failed to create organization setting')
  return row
}

export const getExportSetting = async (organizationId: OrganizationId) => {
  const tenantDb = getTenantDb(organizationId)
  return await tenantDb
    .selectFrom('exportSettings')
    .selectAll()
    .executeTakeFirst()
}

export const getIntegration = async (organizationId: OrganizationId) => {
  return await db
    .selectFrom('integrations')
    .selectAll()
    .where('organizationId', '=', organizationId)
    .executeTakeFirst()
}

export const getGithubAppLink = async (organizationId: OrganizationId) => {
  return (
    (await db
      .selectFrom('githubAppLinks')
      .select(['githubOrg', 'appRepositorySelection', 'installationId'])
      .where('organizationId', '=', organizationId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst()) ?? null
  )
}
