import { db } from '~/app/services/db.server'
import type { GithubAppLinkEventSource } from '~/app/services/github-app-link-events.server'
import { tryLogGithubAppLinkEvent } from '~/app/services/github-app-link-events.server'
import { getTenantDb } from '~/app/services/tenant-db.server'
import type { OrganizationId } from '~/app/types/organization'

export type ReassignmentSource = Extract<
  GithubAppLinkEventSource,
  | 'installation_webhook'
  | 'installation_repositories_webhook'
  | 'user_disconnect'
  | 'cli_repair'
  | 'manual_reassign'
>

/**
 * Replace `repository.github_installation_id` when a link is lost. By default
 * operates on every repository whose canonical is still `lostInstallationId`
 * (the `installation.deleted` case). Pass `repositoryIds` to scope to a
 * specific subset (e.g. `installation_repositories.removed`, where only a
 * handful of repositories were dropped while the rest still belong to it).
 *
 * Next canonical is picked from `repository_installation_memberships`.
 *
 * Eligibility:
 *   - candidate's link must exist, be active (`deleted_at IS NULL`), not
 *     suspended, and have `membership_initialized_at` set
 *   - membership row must be active (`deleted_at IS NULL`)
 *
 * Outcomes per repository:
 *   - 1 eligible candidate → reassign + emit `canonical_reassigned`
 *   - 0 eligible candidates → null + emit `canonical_cleared` (or
 *     `assignment_required` if any uninitialized link still exists for the org)
 *   - 2+ eligible candidates → null + emit `assignment_required`
 *
 * Cross-store rule (RDD: tenant first / shared second): tenant repository rows
 * are updated and tenant memberships are inspected before any shared-DB write.
 * The shared-DB audit log entries are written best-effort after the tenant
 * mutation succeeds.
 */
export async function reassignCanonicalAfterLinkLoss(input: {
  organizationId: OrganizationId
  lostInstallationId: number
  source: ReassignmentSource
  repositoryIds?: string[]
}): Promise<void> {
  const { organizationId, lostInstallationId, source, repositoryIds } = input

  const links = await db
    .selectFrom('githubAppLinks')
    .select(['installationId', 'suspendedAt', 'membershipInitializedAt'])
    .where('organizationId', '=', organizationId)
    .where('deletedAt', 'is', null)
    .where('installationId', '!=', lostInstallationId)
    .execute()
  const eligibleSet = new Set(
    links
      .filter((l) => !l.suspendedAt && l.membershipInitializedAt !== null)
      .map((l) => l.installationId),
  )
  const hasUninitializedLink = links.some(
    (l) => l.membershipInitializedAt === null,
  )

  const tenantDb = getTenantDb(organizationId)

  let rowsQuery = tenantDb
    .selectFrom('repositories')
    .leftJoin(
      'repositoryInstallationMemberships',
      'repositoryInstallationMemberships.repositoryId',
      'repositories.id',
    )
    .select([
      'repositories.id as repositoryId',
      'repositoryInstallationMemberships.installationId as candidateInstallationId',
      'repositoryInstallationMemberships.deletedAt as membershipDeletedAt',
    ])
    .where('repositories.githubInstallationId', '=', lostInstallationId)
  if (repositoryIds !== undefined) {
    rowsQuery = rowsQuery.where('repositories.id', 'in', repositoryIds)
  }
  const rows = await rowsQuery.execute()

  if (rows.length === 0) return

  const candidatesByRepo = new Map<string, Set<number>>()
  for (const row of rows) {
    let bucket = candidatesByRepo.get(row.repositoryId)
    if (!bucket) {
      bucket = new Set()
      candidatesByRepo.set(row.repositoryId, bucket)
    }
    if (
      row.candidateInstallationId !== null &&
      row.membershipDeletedAt === null &&
      row.candidateInstallationId !== lostInstallationId &&
      eligibleSet.has(row.candidateInstallationId)
    ) {
      bucket.add(row.candidateInstallationId)
    }
  }

  const reassignBuckets = new Map<number | null, string[]>()
  type Decision = {
    repositoryId: string
    nextCanonical: number | null
    eventType:
      | 'canonical_reassigned'
      | 'canonical_cleared'
      | 'assignment_required'
    candidateCount: number
  }
  const decisions: Decision[] = []

  for (const [repositoryId, bucket] of candidatesByRepo) {
    const candidates = [...bucket]
    let nextCanonical: number | null
    let eventType: Decision['eventType']
    if (candidates.length === 1) {
      nextCanonical = candidates[0]
      eventType = 'canonical_reassigned'
    } else if (candidates.length === 0) {
      nextCanonical = null
      eventType = hasUninitializedLink
        ? 'assignment_required'
        : 'canonical_cleared'
    } else {
      nextCanonical = null
      eventType = 'assignment_required'
    }
    decisions.push({
      repositoryId,
      nextCanonical,
      eventType,
      candidateCount: candidates.length,
    })

    let group = reassignBuckets.get(nextCanonical)
    if (!group) {
      group = []
      reassignBuckets.set(nextCanonical, group)
    }
    group.push(repositoryId)
  }

  for (const [nextCanonical, repositoryIds] of reassignBuckets) {
    await tenantDb
      .updateTable('repositories')
      .set({ githubInstallationId: nextCanonical })
      .where('id', 'in', repositoryIds)
      .execute()
  }

  for (const decision of decisions) {
    await tryLogGithubAppLinkEvent({
      organizationId,
      installationId: lostInstallationId,
      eventType: decision.eventType,
      source,
      status: 'success',
      details: {
        repositoryId: decision.repositoryId,
        nextCanonical: decision.nextCanonical,
        candidateCount: decision.candidateCount,
      },
    })
  }
}

export async function softDeleteRepositoryMembership(input: {
  organizationId: OrganizationId
  installationId: number
  repositoryId: string
}): Promise<void> {
  const tenantDb = getTenantDb(input.organizationId)
  const now = new Date().toISOString()
  await tenantDb
    .updateTable('repositoryInstallationMemberships')
    .set({ deletedAt: now, updatedAt: now })
    .where('repositoryId', '=', input.repositoryId)
    .where('installationId', '=', input.installationId)
    .where('deletedAt', 'is', null)
    .execute()
}

export async function upsertRepositoryMembership(input: {
  organizationId: OrganizationId
  installationId: number
  repositoryId: string
}): Promise<void> {
  const tenantDb = getTenantDb(input.organizationId)
  const now = new Date().toISOString()
  await tenantDb
    .insertInto('repositoryInstallationMemberships')
    .values({
      repositoryId: input.repositoryId,
      installationId: input.installationId,
    })
    .onConflict((oc) =>
      oc.columns(['repositoryId', 'installationId']).doUpdateSet({
        deletedAt: null,
        updatedAt: now,
      }),
    )
    .execute()
}

/**
 * Initialize `repository_installation_memberships` for an installation by
 * matching the given `(owner, repo)` pairs against existing tenant repositories.
 *
 * Returns the list of repository ids whose membership rows were upserted.
 * Repositories that don't exist in the tenant DB are skipped silently
 * (they may be added later via the repositories.add UI).
 */
export async function initializeMembershipsForInstallation(input: {
  organizationId: OrganizationId
  installationId: number
  repositories: Array<{ owner: string; name: string }>
}): Promise<string[]> {
  if (input.repositories.length === 0) return []

  const tenantDb = getTenantDb(input.organizationId)
  const matched = await tenantDb
    .selectFrom('repositories')
    .select(['id', 'owner', 'repo'])
    .where((eb) =>
      eb.or(
        input.repositories.map((r) =>
          eb.and([eb('owner', '=', r.owner), eb('repo', '=', r.name)]),
        ),
      ),
    )
    .execute()

  if (matched.length === 0) return []

  const now = new Date().toISOString()
  await tenantDb
    .insertInto('repositoryInstallationMemberships')
    .values(
      matched.map((repo) => ({
        repositoryId: repo.id,
        installationId: input.installationId,
      })),
    )
    .onConflict((oc) =>
      oc.columns(['repositoryId', 'installationId']).doUpdateSet({
        deletedAt: null,
        updatedAt: now,
      }),
    )
    .execute()

  return matched.map((r) => r.id)
}
