import { db, type DB, type Insertable } from '~/app/services/db.server'

export const addTeam = (data: Omit<Insertable<DB.Team>, 'updatedAt'>) => {
  return db
    .insertInto('teams')
    .values({ ...data, updatedAt: new Date().toISOString() })
    .executeTakeFirst()
}
