import { db } from '~/app/services/db.server'

export const changeMemberRole = async (memberId: string, role: string) => {
  await db
    .updateTable('members')
    .set({ role })
    .where('id', '=', memberId)
    .execute()
}

export const removeMember = async (memberId: string) => {
  await db.deleteFrom('members').where('id', '=', memberId).execute()
}
