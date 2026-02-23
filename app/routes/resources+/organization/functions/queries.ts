import { db } from '~/app/services/db.server'

export const listUserOrganizations = async (userId: string) => {
  return await db
    .selectFrom('members')
    .innerJoin('organizations', 'organizations.id', 'members.organizationId')
    .select(['organizations.id', 'organizations.name', 'organizations.slug'])
    .where('members.userId', '=', userId)
    .orderBy('members.createdAt', 'asc')
    .execute()
}
