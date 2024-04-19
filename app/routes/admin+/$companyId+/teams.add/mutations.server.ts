import { db, type DB, type Insertable } from '~/app/services/db.server'

export const addTeam = (data: Omit<Insertable<DB.Team>, 'updated_at'>) => {
  return db
    .insertInto('teams')
    .values({ ...data, updated_at: new Date().toISOString() })
    .executeTakeFirst()
}
