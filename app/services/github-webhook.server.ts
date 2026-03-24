import createDebug from 'debug'
import type { Kysely } from 'kysely'
import { clearOrgCache } from '~/app/services/cache.server'
import { db, type DB } from '~/app/services/db.server'

const debug = createDebug('app:github-webhook')

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

type InstallationLike = {
  id: number
  account?: { id: number; login?: string }
  repository_selection?: string
}

function readInstallation(
  payload: Record<string, unknown>,
): InstallationLike | null {
  const inst = payload.installation
  if (!isRecord(inst) || typeof inst.id !== 'number') return null
  const acc = inst.account
  let account: { id: number; login?: string } | undefined
  if (isRecord(acc) && typeof acc.id === 'number') {
    account = {
      id: acc.id,
      login: typeof acc.login === 'string' ? acc.login : undefined,
    }
  }
  const repository_selection =
    typeof inst.repository_selection === 'string'
      ? inst.repository_selection
      : undefined
  return { id: inst.id, account, repository_selection }
}

function selectionFromInstallation(
  installation: InstallationLike,
): 'all' | 'selected' {
  return installation.repository_selection === 'selected' ? 'selected' : 'all'
}

async function findActiveLinkByInstallation(
  trx: Kysely<DB.DB>,
  installationId: number,
) {
  return await trx
    .selectFrom('githubAppLinks')
    .selectAll()
    .where('installationId', '=', installationId)
    .where('deletedAt', 'is', null)
    .executeTakeFirst()
}

async function findActiveLinkByInstallationOrAccount(
  trx: Kysely<DB.DB>,
  installationId: number,
  githubAccountId: number,
) {
  return await trx
    .selectFrom('githubAppLinks')
    .selectAll()
    .where('deletedAt', 'is', null)
    .where((eb) =>
      eb.or([
        eb('installationId', '=', installationId),
        eb('githubAccountId', '=', githubAccountId),
      ]),
    )
    .executeTakeFirst()
}

async function handleInstallationCreated(
  trx: Kysely<DB.DB>,
  installation: InstallationLike,
): Promise<string | null> {
  const accountId = installation.account?.id
  if (accountId === undefined) return null

  const link = await findActiveLinkByInstallationOrAccount(
    trx,
    installation.id,
    accountId,
  )
  if (!link) {
    debug(
      'installation.created: no github_app_links row for installation_id=%s account_id=%s',
      installation.id,
      accountId,
    )
    return null
  }

  const login = installation.account?.login ?? link.githubOrg
  const now = new Date().toISOString()
  await trx
    .updateTable('githubAppLinks')
    .set({
      installationId: installation.id,
      githubAccountId: accountId,
      githubOrg: login,
      appRepositorySelection: selectionFromInstallation(installation),
      updatedAt: now,
    })
    .where('organizationId', '=', link.organizationId)
    .execute()

  return link.organizationId
}

async function handleInstallationDeleted(
  trx: Kysely<DB.DB>,
  installation: InstallationLike,
): Promise<string | null> {
  const link = await findActiveLinkByInstallation(trx, installation.id)
  if (!link) return null

  const now = new Date().toISOString()
  await trx
    .updateTable('githubAppLinks')
    .set({ deletedAt: now, updatedAt: now })
    .where('organizationId', '=', link.organizationId)
    .execute()

  return link.organizationId
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
    .updateTable('integrations')
    .set({
      appSuspendedAt: suspend ? now : null,
      updatedAt: now,
    })
    .where('organizationId', '=', link.organizationId)
    .execute()

  return link.organizationId
}

async function handleInstallationRepositories(
  trx: Kysely<DB.DB>,
  payload: Record<string, unknown>,
): Promise<string | null> {
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
    .execute()

  return link.organizationId
}

async function handleInstallationEvent(
  trx: Kysely<DB.DB>,
  payload: Record<string, unknown>,
): Promise<string | null> {
  const action = payload.action
  if (typeof action !== 'string') return null

  const installation = readInstallation(payload)
  if (!installation) return null

  switch (action) {
    case 'created':
      return await handleInstallationCreated(trx, installation)
    case 'deleted':
      return await handleInstallationDeleted(trx, installation)
    case 'suspend':
      return await handleInstallationSuspend(trx, installation, true)
    case 'unsuspend':
      return await handleInstallationSuspend(trx, installation, false)
    default:
      return null
  }
}

/**
 * Runs shared-DB updates for supported GitHub webhook events (inside one transaction).
 * Call after signature verification and JSON parse. Unknown events are no-ops.
 */
export async function processGithubWebhookPayload(
  event: string | null,
  payload: unknown,
): Promise<void> {
  if (!event || !isRecord(payload)) return

  if (event !== 'installation' && event !== 'installation_repositories') return

  let orgToClear: string | null = null
  await db.transaction().execute(async (trx) => {
    if (event === 'installation') {
      orgToClear = await handleInstallationEvent(trx, payload)
    } else {
      orgToClear = await handleInstallationRepositories(trx, payload)
    }
  })

  if (orgToClear) clearOrgCache(orgToClear)
}
