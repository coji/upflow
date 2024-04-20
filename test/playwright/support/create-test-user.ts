import { nanoid } from 'nanoid'
import { db, sql, type DB, type Insertable } from '~/app/services/db.server'

export const createTestUser = async (
  data: Omit<Insertable<DB.User>, 'id' | 'updatedAt'>,
) => {
  if (!data.email.endsWith('@example.com')) {
    throw new Error('All test emails should be end in @example.com')
  }

  await db
    .insertInto('users')
    .values({
      ...data,
      id: nanoid(),
      updatedAt: sql`CURRENT_TIMESTAMP`,
    })
    .onConflict((cb) =>
      cb.column('email').doUpdateSet((eb) => ({
        role: eb.ref('excluded.role'),
        locale: eb.ref('excluded.locale'),
        pictureUrl: eb.ref('excluded.pictureUrl'),
        displayName: eb.ref('excluded.displayName'),
      })),
    )
    .executeTakeFirst()
}
