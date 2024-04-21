import { nanoid } from 'nanoid'
import {
  db,
  sql,
  type DB,
  type Insertable,
  type Updateable,
} from '~/app/services/db.server'

export const updateCompany = async (
  id: DB.Company['id'],
  data: Omit<Updateable<DB.Company>, 'createdAt' | 'updatedAt'>,
) => {
  return await db
    .updateTable('companies')
    .where('id', '==', id)
    .set({ ...data, updatedAt: sql`CURRENT_TIMESTAMP` })
    .execute()
}

export const deleteCompany = async (id: DB.Company['id']) => {
  return await db.deleteFrom('companies').where('id', '==', id).execute()
}

export const createIntegration = async (data: Insertable<DB.Integration>) => {
  return await db.insertInto('integrations').values(data).execute()
}

export const upsertIntegration = async (
  id: DB.Integration['id'] | undefined,
  data: Omit<Insertable<DB.Integration>, 'id'>,
) => {
  return await db
    .insertInto('integrations')
    .values({ id: id ?? nanoid(), ...data })
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
  id: DB.ExportSetting['id'] | undefined,
  data: Omit<Insertable<DB.ExportSetting>, 'id' | 'updatedAt'>,
) => {
  return await db
    .insertInto('exportSettings')
    .values({ id: id ?? nanoid(), ...data, updatedAt: sql`CURRENT_TIMESTAMP` })
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
