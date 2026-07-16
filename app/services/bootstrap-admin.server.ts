import type { Kysely } from 'kysely'
import type { DB } from '~/app/services/type'

/** Atomically elect and promote the first user of a fresh deployment. */
export async function claimInitialSuperAdmin(
  database: Kysely<DB>,
  userId: string,
): Promise<boolean> {
  return await database.transaction().execute(async (trx) => {
    const marker = await trx
      .insertInto('bootstrapMarkers')
      .values({ key: 'initial_super_admin' })
      .onConflict((oc) => oc.column('key').doNothing())
      .executeTakeFirst()
    if (marker.numInsertedOrUpdatedRows !== 1n) return false
    const promotion = await trx
      .updateTable('users')
      .set({ role: 'admin' })
      .where('id', '=', userId)
      .executeTakeFirst()
    if (promotion.numUpdatedRows !== 1n) {
      await trx
        .deleteFrom('bootstrapMarkers')
        .where('key', '=', 'initial_super_admin')
        .execute()
      return false
    }
    return true
  })
}
