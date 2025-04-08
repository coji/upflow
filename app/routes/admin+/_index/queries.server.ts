import { db } from '~/app/services/db.server'

export const listOrganizations = async () => {
  return await db.selectFrom('organizations').select(['id', 'name']).execute()
}
