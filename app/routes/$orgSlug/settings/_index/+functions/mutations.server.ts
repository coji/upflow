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
  await db.deleteFrom('organizations').where('id', '=', id).execute()
  deleteTenantDb(id)
}

export const upsertIntegration = async (
  organizationId: string,
  data: Omit<Insertable<TenantDB.Integrations>, 'id'>,
) => {
  const tenantDb = getTenantDb(organizationId)
  return await tenantDb
    .insertInto('integrations')
    .values({ id: nanoid(), ...data })
    .onConflict((oc) =>
      oc.column('id').doUpdateSet((eb) => ({
        provider: eb.ref('excluded.provider'),
        method: eb.ref('excluded.method'),
        privateToken: eb.ref('excluded.privateToken'),
      })),
    )
    .execute()
}

export const upsertExportSetting = async (
  organizationId: string,
  data: Omit<Insertable<TenantDB.ExportSettings>, 'id' | 'updatedAt'>,
) => {
  const tenantDb = getTenantDb(organizationId)
  return await tenantDb
    .insertInto('exportSettings')
    .values({ id: nanoid(), ...data, updatedAt: sql`CURRENT_TIMESTAMP` })
    .onConflict((oc) =>
      oc.column('id').doUpdateSet((eb) => ({
        sheetId: eb.ref('excluded.sheetId'),
        clientEmail: eb.ref('excluded.clientEmail'),
        privateKey: eb.ref('excluded.privateKey'),
        updatedAt: eb.ref('excluded.updatedAt'),
      })),
    )
    .execute()
}
