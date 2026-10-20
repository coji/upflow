import { AppError } from '~/app/libs/app-error'
import { isOrgOwner, type MemberRole } from '~/app/libs/member-role'
import { db } from '~/app/services/db.server'
import type { OrganizationId } from '~/app/types/organization'

interface Actor {
  id: string
  role: MemberRole
}

export const changeMemberRole = async (
  memberId: string,
  organizationId: OrganizationId,
  role: MemberRole,
  actor: Actor,
) => {
  if (memberId === actor.id) {
    throw new AppError('Cannot change your own role')
  }
  if (role === 'owner' && !isOrgOwner(actor.role)) {
    throw new AppError('Only owners can grant the owner role')
  }

  const target = await db
    .selectFrom('members')
    .select(['id', 'role'])
    .where('id', '=', memberId)
    .where('organizationId', '=', organizationId)
    .executeTakeFirst()
  if (!target) {
    throw new AppError('Member not found')
  }

  if (target.role === 'owner') {
    if (!isOrgOwner(actor.role)) {
      throw new AppError("Only owners can change an owner's role")
    }
    const ownerCount = await db
      .selectFrom('members')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .where('organizationId', '=', organizationId)
      .where('role', '=', 'owner')
      .executeTakeFirstOrThrow()
    if (ownerCount.count <= 1) {
      throw new AppError('Cannot change the role of the sole owner')
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
  actor: Actor,
) => {
  if (memberId === actor.id) {
    throw new AppError('Cannot remove yourself')
  }

  const member = await db
    .selectFrom('members')
    .select(['id', 'role'])
    .where('id', '=', memberId)
    .where('organizationId', '=', organizationId)
    .executeTakeFirst()
  if (!member) return

  if (member.role === 'owner') {
    if (!isOrgOwner(actor.role)) {
      throw new AppError('Only owners can remove an owner')
    }
    const ownerCount = await db
      .selectFrom('members')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .where('organizationId', '=', organizationId)
      .where('role', '=', 'owner')
      .executeTakeFirstOrThrow()
    if (ownerCount.count <= 1) {
      throw new AppError('Cannot remove the sole owner of the organization')
    }
  }

  await db
    .deleteFrom('members')
    .where('id', '=', memberId)
    .where('organizationId', '=', organizationId)
    .execute()
}
