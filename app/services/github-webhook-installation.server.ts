import createDebug from 'debug'
import type { Kysely } from 'kysely'
import { db, type DB } from '~/app/services/db.server'
import {
  logGithubAppLinkEvent,
  tryLogGithubAppLinkEvent,
} from '~/app/services/github-app-link-events.server'
import {
  reassignCanonicalAfterLinkLoss,
  softDeleteRepositoryMembership,
  upsertRepositoryMembership,
} from '~/app/services/github-app-membership.server'
import {
  findActiveLinkByInstallation,
  isRecord,
  readInstallation,
  selectionFromInstallation,
  type InstallationLike,
} from '~/app/services/github-webhook-shared.server'
import { getTenantDb } from '~/app/services/tenant-db.server'
import type { OrganizationId } from '~/app/types/organization'

const debug = createDebug('app:github-webhook:installation')

type RepoCoord = { owner: string; name: string }

function readRepositoryCoords(payload: Record<string, unknown>): {
  added: RepoCoord[]
  removed: RepoCoord[]
} {
  const collect = (key: string): RepoCoord[] => {
    const list = payload[key]
    if (!Array.isArray(list)) return []
    const out: RepoCoord[] = []
    for (const item of list) {
      if (!isRecord(item)) continue
      const fullName =
        typeof item.full_name === 'string' ? item.full_name : null
      if (!fullName) continue
      const [owner, name] = fullName.split('/')
      if (!owner || !name) continue
      out.push({ owner, name })
    }
    return out
  }
  return {
    added: collect('repositories_added'),
    removed: collect('repositories_removed'),
  }
}

async function handleInstallationCreated(
  trx: Kysely<DB.DB>,
  installation: InstallationLike,
): Promise<string | null> {
  // Setup callback (api.github.setup) is the canonical entry for new links;
  // this webhook only mirrors metadata onto an already-known row.
  const link = await findActiveLinkByInstallation(trx, installation.id)
  if (!link) {
    debug(
      'installation.created: no github_app_links row for installation_id=%s',
      installation.id,
    )
    return null
  }

  const login = installation.account?.login ?? link.githubOrg
  const accountType = installation.account?.type ?? link.githubAccountType
  const now = new Date().toISOString()
  await trx
    .updateTable('githubAppLinks')
    .set({
      githubOrg: login,
      githubAccountType: accountType,
      appRepositorySelection: selectionFromInstallation(installation),
      updatedAt: now,
    })
    .where('organizationId', '=', link.organizationId)
    .where('installationId', '=', installation.id)
    .execute()

  return link.organizationId
}

async function handleInstallationDeleted(
  trx: Kysely<DB.DB>,
  installation: InstallationLike,
): Promise<{ organizationId: string; installationId: number } | null> {
  const link = await findActiveLinkByInstallation(trx, installation.id)
  if (!link) return null

  const now = new Date().toISOString()
  await trx
    .updateTable('githubAppLinks')
    .set({ deletedAt: now, updatedAt: now })
    .where('organizationId', '=', link.organizationId)
    .where('installationId', '=', installation.id)
    .execute()

  // Determine if this was the last active link for the org → revert method.
  const remaining = await trx
    .selectFrom('githubAppLinks')
    .select('installationId')
    .where('organizationId', '=', link.organizationId)
    .where('deletedAt', 'is', null)
    .executeTakeFirst()

  const revertedToToken = !remaining
  if (revertedToToken) {
    await trx
      .updateTable('integrations')
      .set({ method: 'token', appSuspendedAt: null, updatedAt: now })
      .where('organizationId', '=', link.organizationId)
      .execute()
  }

  await logGithubAppLinkEvent(
    {
      organizationId: link.organizationId as OrganizationId,
      installationId: installation.id,
      eventType: 'link_deleted',
      source: 'installation_webhook',
      status: 'success',
      details: { revertedToToken },
    },
    trx,
  )

  return {
    organizationId: link.organizationId,
    installationId: installation.id,
  }
}

async function handleInstallationSuspend(
  trx: Kysely<DB.DB>,
  installation: InstallationLike,
  suspend: boolean,
): Promise<string | null> {
  const link = await findActiveLinkByInstallation(trx, installation.id)
  if (!link) return null

  const now = new Date().toISOString()
  await trx
    .updateTable('githubAppLinks')
    .set({
      suspendedAt: suspend ? now : null,
      updatedAt: now,
    })
    .where('organizationId', '=', link.organizationId)
    .where('installationId', '=', installation.id)
    .execute()

  await logGithubAppLinkEvent(
    {
      organizationId: link.organizationId as OrganizationId,
      installationId: installation.id,
      eventType: suspend ? 'link_suspended' : 'link_unsuspended',
      source: 'installation_webhook',
      status: 'success',
    },
    trx,
  )

  return link.organizationId
}

type InstallRepositoriesUpdate = {
  organizationId: string
  installationId: number
  added: RepoCoord[]
  removed: RepoCoord[]
}

async function handleInstallationRepositoriesEvent(
  trx: Kysely<DB.DB>,
  payload: Record<string, unknown>,
): Promise<InstallRepositoriesUpdate | null> {
  const installation = readInstallation(payload)
  if (!installation) return null

  const link = await findActiveLinkByInstallation(trx, installation.id)
  if (!link) return null

  const now = new Date().toISOString()
  await trx
    .updateTable('githubAppLinks')
    .set({
      appRepositorySelection: selectionFromInstallation(installation),
      updatedAt: now,
    })
    .where('organizationId', '=', link.organizationId)
    .where('installationId', '=', installation.id)
    .execute()

  const { added, removed } = readRepositoryCoords(payload)
  return {
    organizationId: link.organizationId,
    installationId: installation.id,
    added,
    removed,
  }
}

async function resolveRepositoryIdsByCoords(
  organizationId: OrganizationId,
  coords: RepoCoord[],
): Promise<Map<string, string>> {
  if (coords.length === 0) return new Map()
  const tenantDb = getTenantDb(organizationId)
  const rows = await tenantDb
    .selectFrom('repositories')
    .select(['id', 'owner', 'repo'])
    .where((eb) =>
      eb.or(
        coords.map((c) =>
          eb.and([eb('owner', '=', c.owner), eb('repo', '=', c.name)]),
        ),
      ),
    )
    .execute()
  return new Map(rows.map((r) => [`${r.owner}/${r.repo}`, r.id]))
}

async function applyMembershipChangesAfterCommit(
  organizationId: string,
  installationId: number,
  changes: { added: RepoCoord[]; removed: RepoCoord[] },
): Promise<{ removedRepositoryIds: string[] }> {
  const orgId = organizationId as OrganizationId
  const idByCoord = await resolveRepositoryIdsByCoords(orgId, [
    ...changes.added,
    ...changes.removed,
  ])

  for (const repo of changes.added) {
    const repositoryId = idByCoord.get(`${repo.owner}/${repo.name}`)
    if (!repositoryId) continue
    await upsertRepositoryMembership({
      organizationId: orgId,
      installationId,
      repositoryId,
    })
  }

  const removedRepositoryIds: string[] = []
  for (const repo of changes.removed) {
    const repositoryId = idByCoord.get(`${repo.owner}/${repo.name}`)
    if (!repositoryId) continue
    await softDeleteRepositoryMembership({
      organizationId: orgId,
      installationId,
      repositoryId,
    })
    removedRepositoryIds.push(repositoryId)
  }

  return { removedRepositoryIds }
}

async function handleInstallationEvent(
  trx: Kysely<DB.DB>,
  payload: Record<string, unknown>,
): Promise<{
  organizationId: string | null
  deletedInstallationId: number | null
}> {
  const action = payload.action
  if (typeof action !== 'string') {
    return { organizationId: null, deletedInstallationId: null }
  }

  const installation = readInstallation(payload)
  if (!installation) {
    return { organizationId: null, deletedInstallationId: null }
  }

  switch (action) {
    case 'created': {
      const orgId = await handleInstallationCreated(trx, installation)
      return { organizationId: orgId, deletedInstallationId: null }
    }
    case 'deleted': {
      const result = await handleInstallationDeleted(trx, installation)
      if (!result) return { organizationId: null, deletedInstallationId: null }
      return {
        organizationId: result.organizationId,
        deletedInstallationId: result.installationId,
      }
    }
    case 'suspend':
      return {
        organizationId: await handleInstallationSuspend(
          trx,
          installation,
          true,
        ),
        deletedInstallationId: null,
      }
    case 'unsuspend':
      return {
        organizationId: await handleInstallationSuspend(
          trx,
          installation,
          false,
        ),
        deletedInstallationId: null,
      }
    default:
      return { organizationId: null, deletedInstallationId: null }
  }
}

export type WebhookProcessResult = {
  organizationId: string | null
}

export async function runInstallationWebhookInTransaction(
  event: 'installation' | 'installation_repositories',
  payload: Record<string, unknown>,
): Promise<WebhookProcessResult> {
  if (event === 'installation') {
    let deletedInstallationId: number | null = null
    let organizationId: string | null = null
    await db.transaction().execute(async (trx) => {
      const result = await handleInstallationEvent(trx, payload)
      organizationId = result.organizationId
      deletedInstallationId = result.deletedInstallationId
    })
    if (organizationId && deletedInstallationId !== null) {
      await reassignCanonicalAfterLinkLoss({
        organizationId: organizationId as OrganizationId,
        lostInstallationId: deletedInstallationId,
        source: 'installation_webhook',
      })
    }
    return { organizationId }
  }

  const pending: InstallRepositoriesUpdate | null = await db
    .transaction()
    .execute(async (trx) => {
      return await handleInstallationRepositoriesEvent(trx, payload)
    })
  if (pending) {
    const { removedRepositoryIds } = await applyMembershipChangesAfterCommit(
      pending.organizationId,
      pending.installationId,
      { added: pending.added, removed: pending.removed },
    )
    await tryLogGithubAppLinkEvent({
      organizationId: pending.organizationId as OrganizationId,
      installationId: pending.installationId,
      eventType: 'membership_repaired',
      source: 'installation_repositories_webhook',
      status: 'success',
    })
    if (removedRepositoryIds.length > 0) {
      await reassignCanonicalAfterLinkLoss({
        organizationId: pending.organizationId as OrganizationId,
        lostInstallationId: pending.installationId,
        source: 'installation_repositories_webhook',
        repositoryIds: removedRepositoryIds,
      })
    }
  }
  return { organizationId: pending?.organizationId ?? null }
}
