import type { Updateable } from 'kysely'
import { AppError } from '~/app/libs/app-error'
import { getTenantDb, type TenantDB } from '~/app/services/tenant-db.server'
import type { OrganizationId } from '~/app/types/organization'

export const deleteRepository = async (
  organizationId: OrganizationId,
  repositoryId: string,
) => {
  const tenantDb = getTenantDb(organizationId)
  const result = await tenantDb
    .deleteFrom('repositories')
    .where('id', '=', repositoryId)
    .executeTakeFirst()

  if (Number(result.numDeletedRows ?? 0) !== 1) {
    throw new AppError('Repository not found')
  }
}

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
