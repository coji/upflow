import { clearOrgCache } from '~/app/services/cache.server'
import { db } from '~/app/services/db.server'
import type { OrganizationId } from '~/app/types/organization'

/**
 * Soft-delete the org's GitHub App link and revert integration to token method.
 * Clears appSuspendedAt so a prior suspend flag cannot linger after disconnect.
 */
export async function disconnectGithubApp(organizationId: OrganizationId) {
  const now = new Date().toISOString()
  await db.transaction().execute(async (trx) => {
    await trx
      .updateTable('githubAppLinks')
      .set({ deletedAt: now, updatedAt: now })
      .where('organizationId', '=', organizationId)
      .where('deletedAt', 'is', null)
      .execute()

    await trx
      .updateTable('integrations')
      .set({ method: 'token', appSuspendedAt: null, updatedAt: now })
      .where('organizationId', '=', organizationId)
      .execute()
  })
  clearOrgCache(organizationId)
}
