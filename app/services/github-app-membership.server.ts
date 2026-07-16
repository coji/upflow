import type { Kysely, Transaction } from 'kysely'
import { db } from '~/app/services/db.server'
import type { GithubAppLinkEventSource } from '~/app/services/github-app-link-events.server'
import { tryLogGithubAppLinkEvent } from '~/app/services/github-app-link-events.server'
import { getTenantDb } from '~/app/services/tenant-db.server'
import type { DB as TenantDatabase } from '~/app/services/tenant-type'
import type { OrganizationId } from '~/app/types/organization'

export type ReassignmentSource = Extract<
  GithubAppLinkEventSource,
  | 'installation_webhook'
  | 'installation_repositories_webhook'
  | 'installation_update_callback'
  | 'setup_callback'
  | 'existing_installation_link'
  | 'crawl_repair'
  | 'user_disconnect'
  | 'cli_repair'
  | 'manual_reassign'
>

/**
 * Active GitHub App installation ids that are eligible to receive a canonical
 * reassignment for a repository: not deleted, not suspended, and with their
 * `repository_installation_memberships` initialized.
 */
async function fetchEligibleInstallationIds(
  organizationId: OrganizationId,
  options: { excludeInstallationId?: number } = {},
): Promise<{ ids: Set<number>; hasUninitializedLink: boolean }> {
  let linkQuery = db
    .selectFrom('githubAppLinks')
    .select(['installationId', 'suspendedAt', 'membershipInitializedAt'])
    .where('organizationId', '=', organizationId)
    .where('deletedAt', 'is', null)
  if (options.excludeInstallationId !== undefined) {
    linkQuery = linkQuery.where(
      'installationId',
      '!=',
      options.excludeInstallationId,
    )
  }
  const links = await linkQuery.execute()
  const ids = new Set(
    links
      .filter((l) => !l.suspendedAt && l.membershipInitializedAt !== null)
      .map((l) => l.installationId),
  )
  const hasUninitializedLink = links.some(
    (l) => !l.suspendedAt && l.membershipInitializedAt === null,
  )
  return { ids, hasUninitializedLink }
}

export type ReassignBrokenRepositoryResult =
  | { status: 'reassigned'; installationId: number }
  | { status: 'no_candidates' }
  | { status: 'pending_initialization' }
  | { status: 'ambiguous'; candidateCount: number }
  | { status: 'not_found' }
  | { status: 'not_broken' }

/**
 * Try to assign a canonical installation to a single repository whose
 * `github_installation_id` is currently `NULL`. Used by the "Try auto-reassign"
 * UI button and the `reassign-broken-repositories` CLI command.
 *
 * Eligibility rules match {@link reassignCanonicalAfterLinkLoss}: candidate
 * link must be active, non-suspended, and have `membership_initialized_at` set;
 * membership row must be active.
 *
 * Returns a discriminated result so callers can show the appropriate UI:
 *   - `reassigned`: a single eligible candidate was found, repo is now fixed
 *   - `no_candidates`: no installation can see this repo; user must reinstall
 *   - `pending_initialization`: an installation exists but membership init hasn't completed yet
 *   - `ambiguous`: 2+ candidates, manual choice needed
 *   - `not_found`: no repository row exists for the given ID
 *   - `not_broken`: repository already has a `github_installation_id` set
 */
export async function reassignBrokenRepository(input: {
  organizationId: OrganizationId
  repositoryId: string
  source: Extract<GithubAppLinkEventSource, 'manual_reassign' | 'cli_repair'>
}): Promise<ReassignBrokenRepositoryResult> {
  const { organizationId, repositoryId, source } = input
  const tenantDb = getTenantDb(organizationId)

  const repo = await tenantDb
    .selectFrom('repositories')
    .select(['id', 'githubInstallationId'])
    .where('id', '=', repositoryId)
    .executeTakeFirst()
  if (!repo) return { status: 'not_found' }
  if (repo.githubInstallationId !== null) return { status: 'not_broken' }

  const { ids: eligibleSet, hasUninitializedLink } =
    await fetchEligibleInstallationIds(organizationId)

  const memberships = await tenantDb
    .selectFrom('repositoryInstallationMemberships')
    .select(['installationId'])
    .where('repositoryId', '=', repositoryId)
    .where('deletedAt', 'is', null)
    .execute()
  const candidates = memberships
    .map((m) => m.installationId)
    .filter((id) => eligibleSet.has(id))

  if (candidates.length === 1) {
    const nextCanonical = candidates[0]
    const now = new Date().toISOString()
    await tenantDb
      .updateTable('repositories')
      .set({ githubInstallationId: nextCanonical, updatedAt: now })
      .where('id', '=', repositoryId)
      .execute()
    await tryLogGithubAppLinkEvent({
      organizationId,
      installationId: nextCanonical,
      eventType: 'canonical_reassigned',
      source,
      status: 'success',
      details: { repositoryId, candidateCount: 1, recoveredFromBroken: true },
    })
    return { status: 'reassigned', installationId: nextCanonical }
  }

  // Skip the audit log entry for the no-candidates / ambiguous cases: there is
  // no installation to attribute the event to (and the audit table requires a
  // non-null `installationId`). The function return value already conveys the
  // outcome to the UI / CLI caller, which surfaces it via toast / console.
  if (candidates.length === 0) {
    return hasUninitializedLink
      ? { status: 'pending_initialization' }
      : { status: 'no_candidates' }
  }
  return { status: 'ambiguous', candidateCount: candidates.length }
}

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
type ReassignmentDecision = {
  repositoryId: string
  nextCanonical: number | null
  eventType:
    | 'canonical_reassigned'
    | 'canonical_cleared'
    | 'assignment_required'
  candidateCount: number
}

async function applyCanonicalReassignment(
  input: {
    organizationId: OrganizationId
    lostInstallationId: number
    repositoryIds?: string[]
  },
  tenantDb: Kysely<TenantDatabase> | Transaction<TenantDatabase>,
  eligibility: { ids: Set<number>; hasUninitializedLink: boolean },
): Promise<ReassignmentDecision[]> {
  const { lostInstallationId, repositoryIds } = input
  const { ids: eligibleSet, hasUninitializedLink } = eligibility

  const loadRows = (ids?: string[]) => {
    let query = tenantDb
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
    if (ids !== undefined) query = query.where('repositories.id', 'in', ids)
    return query.execute()
  }
  const rows = repositoryIds
    ? (
        await Promise.all(
          Array.from(
            { length: Math.ceil(repositoryIds.length / 200) },
            (_, index) =>
              loadRows(repositoryIds.slice(index * 200, index * 200 + 200)),
          ),
        )
      ).flat()
    : await loadRows()
  if (rows.length === 0) return []

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
  const decisions: ReassignmentDecision[] = []
  for (const [repositoryId, bucket] of candidatesByRepo) {
    const candidates = [...bucket]
    const nextCanonical = candidates.length === 1 ? candidates[0] : null
    const eventType: ReassignmentDecision['eventType'] =
      candidates.length === 1
        ? 'canonical_reassigned'
        : candidates.length === 0 && !hasUninitializedLink
          ? 'canonical_cleared'
          : 'assignment_required'
    decisions.push({
      repositoryId,
      nextCanonical,
      eventType,
      candidateCount: candidates.length,
    })
    const group = reassignBuckets.get(nextCanonical) ?? []
    group.push(repositoryId)
    reassignBuckets.set(nextCanonical, group)
  }

  const now = new Date().toISOString()
  for (const [nextCanonical, groupedRepositoryIds] of reassignBuckets) {
    for (let offset = 0; offset < groupedRepositoryIds.length; offset += 200) {
      await tenantDb
        .updateTable('repositories')
        .set({ githubInstallationId: nextCanonical, updatedAt: now })
        .where('id', 'in', groupedRepositoryIds.slice(offset, offset + 200))
        .execute()
    }
  }
  return decisions
}

async function logReassignmentDecisions(input: {
  organizationId: OrganizationId
  lostInstallationId: number
  source: ReassignmentSource
  decisions: ReassignmentDecision[]
}): Promise<void> {
  for (const decision of input.decisions) {
    await tryLogGithubAppLinkEvent({
      organizationId: input.organizationId,
      installationId: input.lostInstallationId,
      eventType: decision.eventType,
      source: input.source,
      status: 'success',
      details: {
        repositoryId: decision.repositoryId,
        nextCanonical: decision.nextCanonical,
        candidateCount: decision.candidateCount,
      },
    })
  }
}

export async function reassignCanonicalAfterLinkLoss(input: {
  organizationId: OrganizationId
  lostInstallationId: number
  source: ReassignmentSource
  repositoryIds?: string[]
}): Promise<void> {
  const eligibility = await fetchEligibleInstallationIds(input.organizationId, {
    excludeInstallationId: input.lostInstallationId,
  })
  const decisions = await applyCanonicalReassignment(
    input,
    getTenantDb(input.organizationId),
    eligibility,
  )
  await logReassignmentDecisions({ ...input, decisions })
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
      updatedAt: now,
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
  snapshotStartedAt?: string
}): Promise<string[]> {
  if (input.repositories.length === 0) return []

  const tenantDb = getTenantDb(input.organizationId)
  const matched: Array<{ id: string; owner: string; repo: string }> = []
  for (let offset = 0; offset < input.repositories.length; offset += 200) {
    const chunk = input.repositories.slice(offset, offset + 200)
    matched.push(
      ...(await tenantDb
        .selectFrom('repositories')
        .select(['id', 'owner', 'repo'])
        .where((eb) =>
          eb.or(
            chunk.map((r) =>
              eb.and([
                eb(eb.fn('lower', ['owner']), '=', r.owner.toLowerCase()),
                eb(eb.fn('lower', ['repo']), '=', r.name.toLowerCase()),
              ]),
            ),
          ),
        )
        .execute()),
    )
  }

  if (matched.length === 0) return []

  const now = new Date().toISOString()
  const upsertedIds: string[] = []
  await tenantDb.transaction().execute(async (tx) => {
    for (let offset = 0; offset < matched.length; offset += 200) {
      const chunk = matched.slice(offset, offset + 200)
      const upserted = await tx
        .insertInto('repositoryInstallationMemberships')
        .values(
          chunk.map((repo) => ({
            repositoryId: repo.id,
            installationId: input.installationId,
            updatedAt: now,
          })),
        )
        .onConflict((oc) => {
          const update = oc
            .columns(['repositoryId', 'installationId'])
            .doUpdateSet({
              deletedAt: null,
              updatedAt: now,
            })
          return input.snapshotStartedAt
            ? update.where('updatedAt', '<=', input.snapshotStartedAt)
            : update
        })
        .returning('repositoryId')
        .execute()
      const chunkUpsertedIds = upserted.map((row) => row.repositoryId)
      upsertedIds.push(...chunkUpsertedIds)

      if (chunkUpsertedIds.length > 0) {
        await tx
          .updateTable('repositories')
          .set({ githubInstallationId: input.installationId, updatedAt: now })
          .where('id', 'in', chunkUpsertedIds)
          .where('githubInstallationId', 'is', null)
          .execute()
      }
    }
  })

  return upsertedIds
}

/** Reconcile removals from an authoritative installation repository snapshot. */
export async function reconcileMembershipSnapshot(input: {
  organizationId: OrganizationId
  installationId: number
  repositories: Array<{ owner: string; name: string }>
  snapshotStartedAt: string
  source: Extract<
    GithubAppLinkEventSource,
    | 'setup_callback'
    | 'existing_installation_link'
    | 'installation_update_callback'
    | 'crawl_repair'
  >
}): Promise<string[]> {
  const tenantDb = getTenantDb(input.organizationId)
  const visible = new Set(
    input.repositories.map(
      (repo) => `${repo.owner.toLowerCase()}/${repo.name.toLowerCase()}`,
    ),
  )
  const active = await tenantDb
    .selectFrom('repositoryInstallationMemberships as membership')
    .innerJoin('repositories as repo', 'repo.id', 'membership.repositoryId')
    .select([
      'membership.repositoryId',
      'membership.updatedAt',
      'repo.owner',
      'repo.repo',
    ])
    .where('membership.installationId', '=', input.installationId)
    .where('membership.deletedAt', 'is', null)
    .execute()
  const removedRows = active.filter(
    (row) =>
      Date.parse(row.updatedAt) <= Date.parse(input.snapshotStartedAt) &&
      !visible.has(`${row.owner.toLowerCase()}/${row.repo.toLowerCase()}`),
  )
  const now = new Date().toISOString()
  const eligibility = await fetchEligibleInstallationIds(input.organizationId, {
    excludeInstallationId: input.installationId,
  })
  const result = await tenantDb.transaction().execute(async (tx) => {
    const deleted: Array<{ repositoryId: string }> = []
    // Each optimistic-concurrency row adds an AND branch. Keep well below
    // SQLite's default expression-depth limit (1,000) for large installations.
    for (let offset = 0; offset < removedRows.length; offset += 200) {
      const chunk = removedRows.slice(offset, offset + 200)
      deleted.push(
        ...(await tx
          .updateTable('repositoryInstallationMemberships')
          .set({ deletedAt: now, updatedAt: now })
          .where('installationId', '=', input.installationId)
          .where(
            'repositoryId',
            'in',
            chunk.map((row) => row.repositoryId),
          )
          .where('deletedAt', 'is', null)
          .where((eb) =>
            eb.or(
              chunk.map((row) =>
                eb.and([
                  eb('repositoryId', '=', row.repositoryId),
                  eb('updatedAt', '=', row.updatedAt),
                ]),
              ),
            ),
          )
          .returning('repositoryId')
          .execute()),
      )
    }

    // A previous attempt may have committed the membership removal before an
    // old implementation failed to repair the canonical repository pointer.
    // Include those stale canonical rows so crawl repair remains idempotent.
    const protectedRows = await tx
      .selectFrom('repositoryInstallationMemberships')
      .select(['repositoryId', 'updatedAt'])
      .where('installationId', '=', input.installationId)
      .where('deletedAt', 'is', null)
      .execute()
    const protectedIds = new Set(
      protectedRows
        .filter(
          (row) =>
            Date.parse(row.updatedAt) > Date.parse(input.snapshotStartedAt),
        )
        .map((row) => row.repositoryId),
    )
    const canonicalRows = await tx
      .selectFrom('repositories')
      .select(['id', 'owner', 'repo'])
      .where('githubInstallationId', '=', input.installationId)
      .execute()
    const retryIds = canonicalRows
      .filter(
        (row) =>
          !protectedIds.has(row.id) &&
          !visible.has(`${row.owner.toLowerCase()}/${row.repo.toLowerCase()}`),
      )
      .map((row) => row.id)
    const affectedIds = [
      ...new Set([...deleted.map((row) => row.repositoryId), ...retryIds]),
    ]
    const decisions =
      affectedIds.length === 0
        ? []
        : await applyCanonicalReassignment(
            {
              organizationId: input.organizationId,
              lostInstallationId: input.installationId,
              repositoryIds: affectedIds,
            },
            tx,
            eligibility,
          )
    return { affectedIds, decisions }
  })
  await logReassignmentDecisions({
    organizationId: input.organizationId,
    lostInstallationId: input.installationId,
    source: input.source,
    decisions: result.decisions,
  })
  return result.affectedIds
}
