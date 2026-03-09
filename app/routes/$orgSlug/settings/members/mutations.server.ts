import { db } from '~/app/services/db.server'
import type { OrganizationId } from '~/app/types/organization'

export const changeMemberRole = async (
  memberId: string,
  organizationId: OrganizationId,
  role: 'owner' | 'admin' | 'member',
  currentMembershipId: string,
) => {
  if (memberId === currentMembershipId) {
    throw new Error('Cannot change your own role')
  }

  const target = await db
    .selectFrom('members')
    .select(['id', 'role'])
    .where('id', '=', memberId)
    .where('organizationId', '=', organizationId)
    .executeTakeFirst()
  if (!target) {
    throw new Error('Member not found')
  }

  if (target.role === 'owner') {
    const ownerCount = await db
      .selectFrom('members')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .where('organizationId', '=', organizationId)
      .where('role', '=', 'owner')
      .executeTakeFirstOrThrow()
    if (ownerCount.count <= 1) {
      throw new Error('Cannot change the role of the sole owner')
    }
  }

  await db
    .updateTable('members')
    .set({ role })
    .where('id', '=', memberId)
    .where('organizationId', '=', organizationId)
    .execute()
}

export const removeMember = async (
  memberId: string,
  organizationId: OrganizationId,
  currentMembershipId: string,
) => {
  if (memberId === currentMembershipId) {
    throw new Error('Cannot remove yourself')
  }

  const member = await db
    .selectFrom('members')
    .select(['id', 'role'])
    .where('id', '=', memberId)
    .where('organizationId', '=', organizationId)
    .executeTakeFirst()
  if (!member) return

  if (member.role === 'owner') {
    const ownerCount = await db
      .selectFrom('members')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .where('organizationId', '=', organizationId)
      .where('role', '=', 'owner')
      .executeTakeFirstOrThrow()
    if (ownerCount.count <= 1) {
      throw new Error('Cannot remove the sole owner of the organization')
    }
  }

  await db
    .deleteFrom('members')
    .where('id', '=', memberId)
    .where('organizationId', '=', organizationId)
    .execute()
}
