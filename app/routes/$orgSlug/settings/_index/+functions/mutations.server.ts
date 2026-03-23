import type { Insertable } from 'kysely'
import { nanoid } from 'nanoid'
import { db, sql, type DB, type Updateable } from '~/app/services/db.server'
import {
  deleteTenantDb,
  getTenantDb,
  type TenantDB,
} from '~/app/services/tenant-db.server'
import type { OrganizationId } from '~/app/types/organization'

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
  organizationId: OrganizationId,
  data: Pick<
    Updateable<TenantDB.OrganizationSettings>,
    | 'releaseDetectionMethod'
    | 'releaseDetectionKey'
    | 'isActive'
    | 'timezone'
    | 'language'
  >,
) => {
  const tenantDb = getTenantDb(organizationId)
  return await tenantDb
    .updateTable('organizationSettings')
    .set({ ...data, updatedAt: sql`CURRENT_TIMESTAMP` })
    .execute()
}

export const deleteOrganization = async (id: OrganizationId) => {
  await deleteTenantDb(id)
  await db.deleteFrom('organizations').where('id', '=', id).execute()
}

export const upsertIntegration = async (
  organizationId: OrganizationId,
  data: Omit<
    Insertable<DB.Integrations>,
    'id' | 'organizationId' | 'createdAt' | 'updatedAt'
  >,
) => {
  const existing = await db
    .selectFrom('integrations')
    .select('id')
    .where('organizationId', '=', organizationId)
    .executeTakeFirst()

  if (existing) {
    return await db
      .updateTable('integrations')
      .where('organizationId', '=', organizationId)
      .set(data)
      .execute()
  }
  return await db
    .insertInto('integrations')
    .values({
      id: nanoid(),
      organizationId,
      ...data,
    })
    .execute()
}

export const upsertExportSetting = async (
  organizationId: OrganizationId,
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
