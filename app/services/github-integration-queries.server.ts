import { AppError } from '~/app/libs/app-error'
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
 *
 * Order is deterministic: `createdAt ASC` (inherited from {@link getGithubAppLinks}).
 * Callers that deduplicate repos across installations rely on this to
 * keep the "oldest installation wins" attribution stable across reloads.
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
    throw new AppError(
      `Installation ${installationId} does not belong to this organization`,
    )
  }
  if (link.deletedAt !== null) {
    throw new AppError(`Installation ${installationId} is disconnected`)
  }
  if (link.suspendedAt !== null) {
    throw new AppError(`Installation ${installationId} is suspended`)
  }
}
