import { db } from '~/app/services/db.server'
import type { OrganizationId } from '~/app/types/organization'

export const getIntegration = async (organizationId: OrganizationId) => {
  return await db
    .selectFrom('integrations')
    .selectAll()
    .where('organizationId', '=', organizationId)
    .executeTakeFirst()
}
