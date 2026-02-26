import type { Insertable } from 'kysely'
import { nanoid } from 'nanoid'
import { db, sql, type DB, type Updateable } from '~/app/services/db.server'
import {
  deleteTenantDb,
  getTenantDb,
  type TenantDB,
} from '~/app/services/tenant-db.server'

export const updateOrganization = async (
  id: string,
  data: Omit<Updateable<DB.Organizations>, 'createdAt'>,
) => {
  return await db
    .updateTable('organizations')
    .where('id', '=', id)
    .set({ ...data })
    .execute()
}

export const updateOrganizationSetting = async (
  organizationId: string,
  data: Pick<
    Updateable<TenantDB.OrganizationSettings>,
    | 'releaseDetectionMethod'
    | 'releaseDetectionKey'
    | 'isActive'
    | 'excludedUsers'
  >,
) => {
  const tenantDb = getTenantDb(organizationId)
  return await tenantDb
    .updateTable('organizationSettings')
    .set({ ...data, updatedAt: sql`CURRENT_TIMESTAMP` })
    .execute()
}

export const deleteOrganization = async (id: string) => {
  await deleteTenantDb(id)
  await db.deleteFrom('organizations').where('id', '=', id).execute()
}

export const upsertIntegration = async (
  organizationId: string,
  data: Omit<Insertable<TenantDB.Integrations>, 'id'>,
) => {
  const tenantDb = getTenantDb(organizationId)
  const existing = await tenantDb
    .selectFrom('integrations')
    .select('id')
    .executeTakeFirst()

  if (existing) {
    return await tenantDb
      .updateTable('integrations')
      .where('id', '=', existing.id)
      .set(data)
      .execute()
  }
  return await tenantDb
    .insertInto('integrations')
    .values({ id: nanoid(), ...data })
    .execute()
}

export const upsertExportSetting = async (
  organizationId: string,
  data: Omit<Insertable<TenantDB.ExportSettings>, 'id' | 'updatedAt'>,
) => {
  const tenantDb = getTenantDb(organizationId)
  const existing = await tenantDb
    .selectFrom('exportSettings')
    .select('id')
    .executeTakeFirst()

  if (existing) {
    return await tenantDb
      .updateTable('exportSettings')
      .where('id', '=', existing.id)
      .set({ ...data, updatedAt: sql`CURRENT_TIMESTAMP` })
      .execute()
  }
  return await tenantDb
    .insertInto('exportSettings')
    .values({ id: nanoid(), ...data, updatedAt: sql`CURRENT_TIMESTAMP` })
    .execute()
}
