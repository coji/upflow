import { db } from '~/app/services/db.server'

export const listUserOrganizations = async (userId: string) => {
  const teams = await db
    .selectFrom('organizations')
    .select(['id', 'name'])
    .orderBy('organizations.createdAt')
    .execute()
  return teams
}
