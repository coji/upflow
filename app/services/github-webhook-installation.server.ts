import createDebug from 'debug'
import type { Kysely } from 'kysely'
import { db, type DB } from '~/app/services/db.server'
import {
  findActiveLinkByInstallation,
  readInstallation,
  selectionFromInstallation,
  type InstallationLike,
} from '~/app/services/github-webhook-shared.server'

const debug = createDebug('app:github-webhook:installation')

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

export async function runInstallationWebhookInTransaction(
  event: 'installation' | 'installation_repositories',
  payload: Record<string, unknown>,
): Promise<string | null> {
  return await db.transaction().execute(async (trx) => {
    if (event === 'installation') {
      return await handleInstallationEvent(trx, payload)
    }
    return await handleInstallationRepositories(trx, payload)
  })
}
