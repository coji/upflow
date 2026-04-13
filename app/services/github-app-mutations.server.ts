import { clearOrgCache } from '~/app/services/cache.server'
import { db } from '~/app/services/db.server'
import { logGithubAppLinkEvent } from '~/app/services/github-app-link-events.server'
import { createAppOctokit } from '~/app/services/github-octokit.server'
import type { OrganizationId } from '~/app/types/organization'

/**
 * Soft-delete a single GitHub App installation link.
 *
 * Reverts `integrations.method` to `'token'` only when the deleted link was
 * the last active one for the org.
 *
 * Writes a `link_deleted` audit log event with `source='user_disconnect'`.
 *
 * Idempotent: a no-op if the link is already deleted or does not exist.
 */
export async function disconnectGithubAppLink(
  organizationId: OrganizationId,
  installationId: number,
) {
  const now = new Date().toISOString()

  await db.transaction().execute(async (trx) => {
    const updateResult = await trx
      .updateTable('githubAppLinks')
      .set({ deletedAt: now, updatedAt: now })
      .where('organizationId', '=', organizationId)
      .where('installationId', '=', installationId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst()

    if (updateResult.numUpdatedRows === 0n) return

    const remaining = await trx
      .selectFrom('githubAppLinks')
      .select('installationId')
      .where('organizationId', '=', organizationId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst()

    const revertedToToken = !remaining
    if (revertedToToken) {
      await trx
        .updateTable('integrations')
        .set({ method: 'token', updatedAt: now })
        .where('organizationId', '=', organizationId)
        .execute()
    }

    await logGithubAppLinkEvent(
      {
        organizationId,
        installationId,
        eventType: 'link_deleted',
        source: 'user_disconnect',
        status: 'success',
        details: { revertedToToken },
      },
      trx,
    )
  })

  clearOrgCache(organizationId)

  // Best-effort: delete the installation on GitHub so webhooks stop and the
  // user doesn't need to manually uninstall. The Upflow-side disconnect has
  // already succeeded at this point. The subsequent `installation.deleted`
  // webhook will be a no-op because the link is already soft-deleted.
  try {
    const appOctokit = createAppOctokit()
    await appOctokit.rest.apps.deleteInstallation({
      installation_id: installationId,
    })
  } catch (e) {
    console.warn(
      `[disconnectGithubAppLink] Failed to delete GitHub installation ${installationId}:`,
      e,
    )
  }
}

/**
 * Soft-delete every active GitHub App link for the org in a single transaction
 * and revert integration to token method. Convenience for legacy "disconnect all"
 * UI flows that treat GitHub App as a single org-wide connection.
 *
 * Writes one `link_deleted` audit log entry per affected installation.
 *
 * @deprecated Prefer {@link disconnectGithubAppLink} for installation-scoped
 *   disconnects.
 */
export async function disconnectGithubApp(organizationId: OrganizationId) {
  const now = new Date().toISOString()

  const deletedInstallationIds: number[] = []

  await db.transaction().execute(async (trx) => {
    const links = await trx
      .selectFrom('githubAppLinks')
      .select('installationId')
      .where('organizationId', '=', organizationId)
      .where('deletedAt', 'is', null)
      .execute()

    if (links.length > 0) {
      await trx
        .updateTable('githubAppLinks')
        .set({ deletedAt: now, updatedAt: now })
        .where('organizationId', '=', organizationId)
        .where('deletedAt', 'is', null)
        .execute()
    }

    await trx
      .updateTable('integrations')
      .set({ method: 'token', updatedAt: now })
      .where('organizationId', '=', organizationId)
      .execute()

    for (const link of links) {
      await logGithubAppLinkEvent(
        {
          organizationId,
          installationId: link.installationId,
          eventType: 'link_deleted',
          source: 'user_disconnect',
          status: 'success',
          details: { revertedToToken: true },
        },
        trx,
      )
      deletedInstallationIds.push(link.installationId)
    }
  })

  clearOrgCache(organizationId)

  if (deletedInstallationIds.length > 0) {
    const appOctokit = createAppOctokit()
    await Promise.allSettled(
      deletedInstallationIds.map((id) =>
        appOctokit.rest.apps.deleteInstallation({ installation_id: id }),
      ),
    )
  }
}
