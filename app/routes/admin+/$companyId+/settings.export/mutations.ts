import {
  db,
  type DB,
  type Insertable,
  type Updateable,
} from '~/app/services/db.server'

export const insertExportSetting = async (
  data: Insertable<DB.ExportSetting>,
) => {
  return await db
    .insertInto('export_settings')
    .values(data)
    .onConflict((oc) =>
      oc
        .column('id')
        .doUpdateSet({ ...data, updated_at: new Date().toISOString() }),
    )
    .execute()
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
