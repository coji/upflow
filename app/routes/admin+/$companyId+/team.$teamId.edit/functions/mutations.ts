import { db, type DB, type Updateable } from '~/app/services/db.server'

export const updateTeam = (
  teamId: DB.Team['id'],
  data: Updateable<DB.Team>,
) => {
  return db
    .updateTable('teams')
    .where('id', '==', teamId)
    .set(data)
    .executeTakeFirst()
}

export const deleteTeam = (teamId: DB.Team['id']) => {
  return db.deleteFrom('teams').where('id', '==', teamId).execute()
}
