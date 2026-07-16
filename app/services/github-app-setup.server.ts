import { nanoid } from 'nanoid'
import { getErrorMessage } from '~/app/libs/error-message'
import { clearOrgCache } from '~/app/services/cache.server'
import { db } from '~/app/services/db.server'
import {
  type GithubAppLinkEventSource,
  logGithubAppLinkEvent,
  tryLogGithubAppLinkEvent,
} from '~/app/services/github-app-link-events.server'
import {
  initializeMembershipsForInstallation,
  reassignCanonicalAfterLinkLoss,
  reconcileMembershipSnapshot,
} from '~/app/services/github-app-membership.server'
import { fetchInstallationRepositories } from '~/app/services/github-installation-repos.server'
import {
  createAppOctokit,
  resolveOctokitForInstallation,
} from '~/app/services/github-octokit.server'
import type { OrganizationId } from '~/app/types/organization'

export type VerifiedGithubInstallation = {
  id: number
  account: { id: number; login: string; type: string | null }
  repositorySelection: 'all' | 'selected'
  suspendedAt: string | null
}

export class GithubInstallationAlreadyLinkedError extends Error {
  override readonly name = 'GithubInstallationAlreadyLinkedError'
}

export class GithubInstallationAuthorizationError extends Error {
  override readonly name = 'GithubInstallationAuthorizationError'
}

export async function verifyGithubInstallation(
  installationId: number,
): Promise<VerifiedGithubInstallation> {
  const appOctokit = createAppOctokit()
  const { data } = await appOctokit.rest.apps.getInstallation({
    installation_id: installationId,
  })
  const account = data.account
  if (
    !account ||
    typeof account.id !== 'number' ||
    !('login' in account) ||
    typeof account.login !== 'string'
  ) {
    throw new Error('Invalid installation account')
  }

  return {
    id: data.id,
    account: {
      id: account.id,
      login: account.login,
      type:
        'type' in account && typeof account.type === 'string'
          ? account.type
          : null,
    },
    repositorySelection:
      data.repository_selection === 'selected' ? 'selected' : 'all',
    suspendedAt:
      typeof data.suspended_at === 'string' ? data.suspended_at : null,
  }
}

/**
 * Prove through GitHub, not callback parameters, that the signed-in user can
 * manage the installation. Organization ownership is checked with the
 * installation token, so this also works with GitHub App user access tokens,
 * which do not expose OAuth scopes.
 */
export async function verifyUserCanManageGithubInstallation(
  userId: string,
  installation: VerifiedGithubInstallation,
): Promise<void> {
  if (installation.suspendedAt !== null) {
    throw new GithubInstallationAuthorizationError(
      'This GitHub App installation is suspended. Unsuspend it in GitHub, then retry.',
    )
  }

  const account = await db
    .selectFrom('accounts')
    .select('accountId')
    .where('userId', '=', userId)
    .where('providerId', '=', 'github')
    .executeTakeFirst()

  if (!account) {
    throw new GithubInstallationAuthorizationError(
      'GitHub authorization is missing. Sign out, sign in again, and retry from Integration settings.',
    )
  }

  if (installation.account.type === 'User') {
    if (account.accountId !== String(installation.account.id)) {
      throw new GithubInstallationAuthorizationError(
        'The signed-in GitHub user does not own this installation.',
      )
    }
    return
  }

  if (installation.account.type !== 'Organization') {
    throw new GithubInstallationAuthorizationError(
      'This GitHub installation account type is not supported.',
    )
  }

  try {
    const installationOctokit = resolveOctokitForInstallation(installation.id)
    const { data: githubUser } = await installationOctokit.rest.users.getById({
      account_id: Number(account.accountId),
    })
    const { data: membership } =
      await installationOctokit.rest.orgs.getMembershipForUser({
        org: installation.account.login,
        username: githubUser.login,
      })
    if (membership.role !== 'admin' || membership.state !== 'active') {
      throw new GithubInstallationAuthorizationError(
        'The signed-in GitHub user is not an active owner of this organization.',
      )
    }
  } catch (error) {
    if (error instanceof GithubInstallationAuthorizationError) {
      throw error
    }
    const status =
      typeof error === 'object' &&
      error !== null &&
      'status' in error &&
      typeof error.status === 'number'
        ? error.status
        : null
    if (status === 401 || status === 403 || status === 404) {
      throw new GithubInstallationAuthorizationError(
        status === 404
          ? 'The signed-in GitHub user does not own this installation.'
          : 'GitHub could not verify organization ownership. An organization owner must approve the GitHub App’s pending organization Members (read) permission under GitHub Settings → Installed GitHub Apps, then retry.',
      )
    }
    // Network failures and GitHub 5xx responses are operational failures, not
    // proof that the user lacks permission. Preserve them for retry/monitoring.
    throw error
  }
}

export async function completeGithubAppSetup(input: {
  organizationId: OrganizationId
  installation: VerifiedGithubInstallation
  source?: Extract<
    GithubAppLinkEventSource,
    | 'setup_callback'
    | 'existing_installation_link'
    | 'installation_update_callback'
  >
}): Promise<void> {
  const { organizationId, installation } = input
  const source = input.source ?? 'setup_callback'
  const now = new Date().toISOString()
  try {
    await db.transaction().execute(async (trx) => {
      const existingOwner = await trx
        .selectFrom('githubAppLinks')
        .select(['organizationId', 'deletedAt'])
        .where('installationId', '=', installation.id)
        .executeTakeFirst()
      if (
        source === 'installation_update_callback' &&
        (!existingOwner ||
          existingOwner.organizationId !== organizationId ||
          existingOwner.deletedAt !== null)
      ) {
        throw new GithubInstallationAlreadyLinkedError(
          'This GitHub installation is no longer actively linked.',
        )
      }
      if (existingOwner && existingOwner.organizationId !== organizationId) {
        if (existingOwner.deletedAt === null) {
          throw new GithubInstallationAlreadyLinkedError(
            'This GitHub installation is already linked to another Upflow organization',
          )
        }
        await trx
          .deleteFrom('githubAppLinks')
          .where('installationId', '=', installation.id)
          .where('deletedAt', 'is not', null)
          .execute()
      }

      if (source === 'installation_update_callback') {
        const update = await trx
          .updateTable('githubAppLinks')
          .set({
            githubAccountId: installation.account.id,
            githubAccountType: installation.account.type,
            githubOrg: installation.account.login,
            appRepositorySelection: installation.repositorySelection,
            suspendedAt: installation.suspendedAt,
            membershipInitializedAt: null,
            updatedAt: now,
          })
          .where('organizationId', '=', organizationId)
          .where('installationId', '=', installation.id)
          .where('deletedAt', 'is', null)
          .executeTakeFirst()
        if (update.numUpdatedRows !== 1n) {
          throw new GithubInstallationAlreadyLinkedError(
            'This GitHub installation was disconnected during the update.',
          )
        }
      } else {
        await trx
          .insertInto('githubAppLinks')
          .values({
            organizationId,
            installationId: installation.id,
            githubAccountId: installation.account.id,
            githubAccountType: installation.account.type,
            githubOrg: installation.account.login,
            appRepositorySelection: installation.repositorySelection,
            suspendedAt: installation.suspendedAt,
            deletedAt: null,
          })
          .onConflict((oc) =>
            oc.columns(['organizationId', 'installationId']).doUpdateSet({
              githubAccountId: installation.account.id,
              githubAccountType: installation.account.type,
              githubOrg: installation.account.login,
              appRepositorySelection: installation.repositorySelection,
              suspendedAt: installation.suspendedAt,
              membershipInitializedAt: null,
              deletedAt: null,
              updatedAt: now,
            }),
          )
          .execute()
      }

      await trx
        .insertInto('integrations')
        .values({
          id: nanoid(),
          organizationId,
          provider: 'github',
          method: 'github_app',
          privateToken: null,
        })
        .onConflict((oc) =>
          oc.column('organizationId').doUpdateSet({
            method: 'github_app',
            updatedAt: now,
          }),
        )
        .execute()

      await logGithubAppLinkEvent(
        {
          organizationId,
          installationId: installation.id,
          eventType:
            existingOwner?.deletedAt === null ? 'link_updated' : 'link_created',
          source,
          status: 'success',
          details: { accountType: installation.account.type },
        },
        trx,
      )
    })
  } catch (error) {
    // The installation id is globally unique. A second organization can race
    // past the pre-insert lookup; translate the losing unique-index failure to
    // the same domain conflict returned by the non-racing path.
    const isUniqueConstraint =
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error.code === 'SQLITE_CONSTRAINT_UNIQUE' ||
        error.code === 'SQLITE_CONSTRAINT_PRIMARYKEY')
    if (!isUniqueConstraint) throw error

    const winner = await db
      .selectFrom('githubAppLinks')
      .select(['organizationId', 'deletedAt'])
      .where('installationId', '=', installation.id)
      .executeTakeFirst()
    if (
      winner?.deletedAt === null &&
      winner.organizationId !== organizationId
    ) {
      throw new GithubInstallationAlreadyLinkedError(
        'This GitHub installation is already linked to another Upflow organization',
      )
    }
    throw error
  }

  // Membership initialization is deliberately best-effort. The shared link is
  // already durable; a later crawl repairs rows left uninitialized here.
  try {
    const activeLink = await db
      .selectFrom('githubAppLinks')
      .select('installationId')
      .where('organizationId', '=', organizationId)
      .where('installationId', '=', installation.id)
      .where('deletedAt', 'is', null)
      .executeTakeFirst()
    if (!activeLink) {
      throw new Error('GitHub App link was disconnected during setup')
    }

    const snapshotStartedAt = new Date().toISOString()
    const repos = await fetchInstallationRepositories(installation.id)
    await initializeMembershipsForInstallation({
      organizationId,
      installationId: installation.id,
      repositories: repos,
      snapshotStartedAt,
    })
    // Every successful setup fetch is a complete GitHub-side snapshot. This
    // also repairs missed repository-removal webhooks during manual reconnects.
    await reconcileMembershipSnapshot({
      organizationId,
      installationId: installation.id,
      repositories: repos,
      snapshotStartedAt,
      source,
    })
    const initialized = await db
      .updateTable('githubAppLinks')
      .set({ membershipInitializedAt: new Date().toISOString() })
      .where('organizationId', '=', organizationId)
      .where('installationId', '=', installation.id)
      .where('deletedAt', 'is', null)
      .executeTakeFirst()
    if (initialized.numUpdatedRows !== 1n) {
      // A disconnect can race after the active-link check and after the tenant
      // membership writes. Undo any canonical assignments restored by this
      // refresh so a deleted installation cannot remain selected.
      await reassignCanonicalAfterLinkLoss({
        organizationId,
        lostInstallationId: installation.id,
        source,
      })
      throw new Error('GitHub App link was disconnected during setup')
    }
    await tryLogGithubAppLinkEvent({
      organizationId,
      installationId: installation.id,
      eventType: 'membership_initialized',
      source,
      status: 'success',
      details: { repoCount: repos.length },
    })
  } catch (e) {
    console.error('[github-app-setup] membership init failed', e)
    if (source === 'installation_update_callback') {
      await db
        .updateTable('githubAppLinks')
        .set({ membershipInitializedAt: null })
        .where('organizationId', '=', organizationId)
        .where('installationId', '=', installation.id)
        .where('deletedAt', 'is', null)
        .execute()
    }
    await tryLogGithubAppLinkEvent({
      organizationId,
      installationId: installation.id,
      eventType: 'membership_initialized',
      source,
      status: 'failed',
      details: { error: getErrorMessage(e) },
    })
  }

  clearOrgCache(organizationId)
}
