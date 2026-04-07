import { db } from '~/app/services/db.server'
import type { OrganizationId } from '~/app/types/organization'

const githubAppLinkColumns = [
  'organizationId',
  'installationId',
  'githubAccountId',
  'githubAccountType',
  'githubOrg',
  'appRepositorySelection',
  'suspendedAt',
  'membershipInitializedAt',
] as const

export const getIntegration = async (organizationId: OrganizationId) => {
  return await db
    .selectFrom('integrations')
    .selectAll()
    .where('organizationId', '=', organizationId)
    .executeTakeFirst()
}

/**
 * All active (not deleted) GitHub App links for an organization, ordered by
 * `createdAt` for deterministic iteration.
 */
export const getGithubAppLinks = async (organizationId: OrganizationId) => {
  return await db
    .selectFrom('githubAppLinks')
    .select(githubAppLinkColumns)
    .where('organizationId', '=', organizationId)
    .where('deletedAt', 'is', null)
    .orderBy('createdAt', 'asc')
    .execute()
}

/**
 * Oldest active GitHub App link for an organization, or null.
 *
 * @deprecated Returns an arbitrary link when an org has multiple active
 *   installations. Use {@link getGithubAppLinks} and operate per-installation.
 */
export const getGithubAppLink = async (organizationId: OrganizationId) => {
  const links = await getGithubAppLinks(organizationId)
  return links[0] ?? null
}

export const getGithubAppLinkByInstallationId = async (
  installationId: number,
) => {
  return (
    (await db
      .selectFrom('githubAppLinks')
      .select([...githubAppLinkColumns, 'deletedAt'])
      .where('installationId', '=', installationId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst()) ?? null
  )
}

export type ActiveInstallationOption = {
  installationId: number
  githubOrg: string
  githubAccountType: string | null
  appRepositorySelection: 'all' | 'selected'
}

/**
 * Active (non-deleted, non-suspended) installations for an org in the shape
 * UI loaders need for installation selectors. Suspended links are excluded
 * because they can't be used for API calls.
 */
export const getActiveInstallationOptions = async (
  organizationId: OrganizationId,
): Promise<ActiveInstallationOption[]> => {
  const links = await getGithubAppLinks(organizationId)
  return links
    .filter((l) => l.suspendedAt === null)
    .map((l) => ({
      installationId: l.installationId,
      githubOrg: l.githubOrg,
      githubAccountType: l.githubAccountType,
      appRepositorySelection: l.appRepositorySelection,
    }))
}

/**
 * Boundary guard for client-provided `installationId`. Throws if the
 * installation does not belong to the given org or is deleted/suspended.
 *
 * The query is constrained by `organizationId` first so the database can never
 * leak the existence of installations from other organizations — even the
 * "not found" branch only fires when the row is missing *for this org*.
 */
export const assertInstallationBelongsToOrg = async (
  organizationId: OrganizationId,
  installationId: number,
): Promise<void> => {
  const link = await db
    .selectFrom('githubAppLinks')
    .select(['suspendedAt', 'deletedAt'])
    .where('organizationId', '=', organizationId)
    .where('installationId', '=', installationId)
    .executeTakeFirst()

  if (!link) {
    throw new Error(
      `Installation ${installationId} does not belong to this organization`,
    )
  }
  if (link.deletedAt !== null) {
    throw new Error(`Installation ${installationId} is disconnected`)
  }
  if (link.suspendedAt !== null) {
    throw new Error(`Installation ${installationId} is suspended`)
  }
}
