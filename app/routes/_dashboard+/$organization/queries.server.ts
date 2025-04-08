import { db } from '~/app/services/db.server'

export const getOrganization = async (organizationId: string) => {
  return await db
    .selectFrom('organizations')
    .select(['id', 'name'])
    .where('id', '=', organizationId)
    .executeTakeFirst()
}
