import type { Updateable } from 'kysely'
import {
  getTenantDb,
  type OrganizationId,
  type TenantDB,
} from '~/app/services/tenant-db.server'

export const updateRepository = (
  organizationId: OrganizationId,
  repositoryId: string,
  data: Pick<
    Updateable<TenantDB.Repositories>,
    'owner' | 'repo' | 'releaseDetectionMethod' | 'releaseDetectionKey'
  >,
) => {
  const tenantDb = getTenantDb(organizationId)
  return tenantDb
    .updateTable('repositories')
    .where('id', '=', repositoryId)
    .set(data)
    .executeTakeFirst()
}
