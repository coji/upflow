import { db, type DB } from '~/app/services/db.server'

export const listOrganizationMembers = async (
  organizationId: DB.Organization['id'],
) => {
  return await db
    .selectFrom('members')
    .selectAll()
    .where('organizationId', '=', organizationId)
    .execute()
}
