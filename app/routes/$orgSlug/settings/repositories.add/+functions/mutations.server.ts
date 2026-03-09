import { nanoid } from 'nanoid'
import { sql } from '~/app/services/db.server'
import { getTenantDb } from '~/app/services/tenant-db.server'
import type { OrganizationId } from '~/app/types/organization'

export const addRepository = async (
  organizationId: OrganizationId,
  data: { owner: string; repo: string },
) => {
  const tenantDb = getTenantDb(organizationId)

  const organizationSetting = await tenantDb
    .selectFrom('organizationSettings')
    .selectAll()
    .executeTakeFirstOrThrow()
  const integration = await tenantDb
    .selectFrom('integrations')
    .selectAll()
    .executeTakeFirstOrThrow()

  return await tenantDb
    .insertInto('repositories')
    .values({
      id: nanoid(),
      integrationId: integration.id,
      provider: integration.provider,
      owner: data.owner,
      repo: data.repo,
      releaseDetectionKey: organizationSetting.releaseDetectionKey,
      releaseDetectionMethod: organizationSetting.releaseDetectionMethod,
      updatedAt: sql`CURRENT_TIMESTAMP`,
    })
    .onConflict((cb) =>
      cb.columns(['integrationId', 'owner', 'repo']).doUpdateSet((eb) => ({
        owner: eb.ref('excluded.owner'),
        repo: eb.ref('excluded.repo'),
        releaseDetectionKey: eb.ref('excluded.releaseDetectionKey'),
        releaseDetectionMethod: eb.ref('excluded.releaseDetectionMethod'),
        updatedAt: eb.ref('excluded.updatedAt'),
      })),
    )
    .executeTakeFirst()
}
