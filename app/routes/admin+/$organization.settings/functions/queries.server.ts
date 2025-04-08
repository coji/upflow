import { db, type DB } from '~/app/services/db.server'

export const getOrganization = async (
  organizationId: DB.Organization['id'],
) => {
  return await db
    .selectFrom('organizations')
    .selectAll()
    .where('id', '=', organizationId)
    .executeTakeFirst()
}

export const getOrganizationSetting = async (
  organizationId: DB.Organization['id'],
) => {
  return await db
    .selectFrom('organizationSettings')
    .selectAll()
    .where('organizationId', '=', organizationId)
    .executeTakeFirst()
}

export const getExportSetting = async (
  organizationId: DB.Organization['id'],
) => {
  return await db
    .selectFrom('exportSettings')
    .selectAll()
    .where('organizationId', '=', organizationId)
    .executeTakeFirst()
}

export const getIntegration = async (organizationId: DB.Organization['id']) => {
  return await db
    .selectFrom('integrations')
    .selectAll()
    .where('organizationId', '=', organizationId)
    .executeTakeFirst()
}
