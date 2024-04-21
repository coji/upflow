import { db, sql, type DB, type Insertable } from '~/app/services/db.server'

export const addTeam = (
  data: Omit<Insertable<DB.Team>, 'updatedAt' | 'createdAt'>,
) => {
  return db
    .insertInto('teams')
    .values({ ...data, updatedAt: sql`CURRENT_TIMESTAMP` })
    .executeTakeFirst()
}
