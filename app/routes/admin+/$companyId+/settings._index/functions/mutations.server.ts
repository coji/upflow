import {
  db,
  type DB,
  type Insertable,
  type Updateable,
} from '~/app/services/db.server'

export const updateCompany = async (
  id: DB.Company['id'],
  data: Updateable<DB.Company>,
) => {
  return await db
    .updateTable('companies')
    .where('id', '==', id)
    .set({ ...data, updated_at: new Date().toISOString() })
    .execute()
}

export const createIntegration = async (data: Insertable<DB.Integration>) => {
  return await db.insertInto('integrations').values(data).execute()
}

export const insertExportSetting = async (
  data: Insertable<DB.ExportSetting>,
) => {
  return await db.insertInto('export_settings').values(data).execute()
}

export const updateExportSetting = async (
  id: DB.ExportSetting['id'],
  data: Updateable<DB.ExportSetting>,
) => {
  return await db
    .updateTable('export_settings')
    .where('id', '==', id)
    .set({ ...data, updated_at: new Date().toISOString() })
    .execute()
}

export const insertIntegration = async (data: Insertable<DB.Integration>) => {
  return await db.insertInto('integrations').values(data).execute()
}

export const updateIntegration = async (
  id: DB.Integration['id'],
  data: Updateable<DB.Integration>,
) => {
  return await db
    .updateTable('integrations')
    .where('id', '==', id)
    .set(data)
    .execute()
}
