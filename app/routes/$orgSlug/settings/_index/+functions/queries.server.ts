import { db, type DB } from '~/app/services/db.server'

export const getOrganization = async (
  organizationId: DB.Organizations['id'],
) => {
  return await db
    .selectFrom('organizations')
    .selectAll()
    .where('id', '=', organizationId)
    .executeTakeFirst()
}

export const getOrganizationSetting = async (
  organizationId: DB.Organizations['id'],
) => {
  return await db
    .selectFrom('organizationSettings')
    .selectAll()
    .where('organizationId', '=', organizationId)
    .executeTakeFirst()
}

export const createDefaultOrganizationSetting = async (
  organizationId: DB.Organizations['id'],
) => {
  const id = crypto.randomUUID()
  await db
    .insertInto('organizationSettings')
    .values({
      id,
      organizationId,
      updatedAt: new Date().toISOString(),
    })
    .execute()
  const row = await getOrganizationSetting(organizationId)
  if (!row) throw new Error('Failed to create organization setting')
  return row
}

export const getExportSetting = async (
  organizationId: DB.Organizations['id'],
) => {
  return await db
    .selectFrom('exportSettings')
    .selectAll()
    .where('organizationId', '=', organizationId)
    .executeTakeFirst()
}

export const getIntegration = async (
  organizationId: DB.Organizations['id'],
) => {
  return await db
    .selectFrom('integrations')
    .selectAll()
    .where('organizationId', '=', organizationId)
    .executeTakeFirst()
}
