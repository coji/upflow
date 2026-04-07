import { nanoid } from 'nanoid'
import { db, sql } from '~/app/services/db.server'
import { upsertRepositoryMembership } from '~/app/services/github-app-membership.server'
import { getTenantDb } from '~/app/services/tenant-db.server'
import type { OrganizationId } from '~/app/types/organization'

export type AddRepositoryResult = {
  id: string
  /**
   * `true` when the repository was inserted but the `repository_installation_memberships`
   * row could not be written. The repo is functional but canonical reassignment
   * after a future installation removal might be inaccurate until the next
   * crawl-time membership repair fixes it.
   */
  membershipUpsertFailed: boolean
}

export const addRepository = async (
  organizationId: OrganizationId,
  data: { owner: string; repo: string; githubInstallationId: number | null },
): Promise<AddRepositoryResult> => {
  const tenantDb = getTenantDb(organizationId)

  const organizationSetting = await tenantDb
    .selectFrom('organizationSettings')
    .selectAll()
    .executeTakeFirstOrThrow()
  const integration = await db
    .selectFrom('integrations')
    .selectAll()
    .where('organizationId', '=', organizationId)
    .executeTakeFirstOrThrow()

  const inserted = await tenantDb
    .insertInto('repositories')
    .values({
      id: nanoid(),
      integrationId: integration.id,
      provider: integration.provider,
      owner: data.owner,
      repo: data.repo,
      githubInstallationId: data.githubInstallationId,
      releaseDetectionKey: organizationSetting.releaseDetectionKey,
      releaseDetectionMethod: organizationSetting.releaseDetectionMethod,
      updatedAt: sql`CURRENT_TIMESTAMP`,
    })
    .onConflict((cb) =>
      cb.columns(['integrationId', 'owner', 'repo']).doUpdateSet((eb) => ({
        owner: eb.ref('excluded.owner'),
        repo: eb.ref('excluded.repo'),
        githubInstallationId: eb.ref('excluded.githubInstallationId'),
        releaseDetectionKey: eb.ref('excluded.releaseDetectionKey'),
        releaseDetectionMethod: eb.ref('excluded.releaseDetectionMethod'),
        updatedAt: eb.ref('excluded.updatedAt'),
      })),
    )
    .returning('id')
    .executeTakeFirstOrThrow()

  let membershipUpsertFailed = false
  if (data.githubInstallationId !== null) {
    try {
      await upsertRepositoryMembership({
        organizationId,
        installationId: data.githubInstallationId,
        repositoryId: inserted.id,
      })
    } catch (e) {
      // Repository row is already committed; surface this so callers don't
      // hide the inconsistency. Crawl-time auto-repair will fix the
      // membership table on the next pass.
      console.error(
        '[addRepository] failed to upsert repository_installation_membership',
        e,
      )
      membershipUpsertFailed = true
    }
  }

  return { id: inserted.id, membershipUpsertFailed }
}
