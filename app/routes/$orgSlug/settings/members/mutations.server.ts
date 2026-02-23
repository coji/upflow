import { db } from '~/app/services/db.server'

export const changeMemberRole = async (
  memberId: string,
  organizationId: string,
  role: string,
) => {
  await db
    .updateTable('members')
    .set({ role })
    .where('id', '=', memberId)
    .where('organizationId', '=', organizationId)
    .execute()
}

export const removeMember = async (
  memberId: string,
  organizationId: string,
) => {
  await db
    .deleteFrom('members')
    .where('id', '=', memberId)
    .where('organizationId', '=', organizationId)
    .execute()
}
