import { nanoid } from 'nanoid'
import { db } from '~/app/services/db.server'
import type { OrganizationId } from '~/app/types/organization'

const INSTALL_STATE_TTL_MS = 7 * 24 * 60 * 60 * 1000
const HANDOFF_STATE_TTL_MS = INSTALL_STATE_TTL_MS
const STATELESS_RECOVERY_TTL_MS = 10 * 60 * 1000

export class InstallStateError extends Error {
  override readonly name = 'InstallStateError'
}

export async function consumeAuthorizedInstallStateDetailed(input: {
  installationId: number
  nonce?: string | null
  userId?: string
}): Promise<{
  organizationId: OrganizationId
  stateId: string
  intentKind: 'direct' | 'handoff' | 'legacy'
}> {
  const now = new Date().toISOString()
  const stateRecoveryCutoff = new Date(
    Date.now() - STATELESS_RECOVERY_TTL_MS,
  ).toISOString()
  const nonce = input.nonce?.trim()

  return await db.transaction().execute(async (trx) => {
    let stateQuery = trx
      .selectFrom('githubAppInstallStates as state')
      .select([
        'state.id',
        'state.organizationId',
        'state.createdAt',
        'state.createdByUserId',
        'state.claimedByUserId',
        'state.intentKind',
        'state.claimedAt',
      ])
      .select((eb) =>
        eb.fn.coalesce('state.claimedAt', 'state.createdAt').as('recoveryAt'),
      )
      .where('state.consumedAt', 'is', null)
      .where('state.expiresAt', '>', now)

    if (nonce) {
      stateQuery = stateQuery.where('state.nonce', '=', nonce)
    } else {
      if (!input.userId) {
        throw new InstallStateError('Authentication is required')
      }
      const userId = input.userId
      stateQuery = stateQuery.where((eb) =>
        eb.or([
          eb.and([
            eb('state.intentKind', '=', 'direct'),
            eb('state.createdByUserId', '=', userId),
            eb('state.createdAt', '>', stateRecoveryCutoff),
          ]),
          eb.and([
            eb('state.intentKind', '=', 'handoff'),
            eb('state.claimedAt', '>', stateRecoveryCutoff),
            eb('state.claimedByUserId', '=', userId),
          ]),
        ]),
      )
    }

    const states = await stateQuery
      .orderBy('recoveryAt', 'desc')
      .orderBy('state.id', 'desc')
      .execute()
    if (states.length === 0) {
      throw new InstallStateError(
        nonce
          ? 'Invalid, expired, or already used install state'
          : 'No pending GitHub App connection was found. Start the connection again from Upflow Integration settings.',
      )
    }
    // Without state there is no reliable way to know which browser tab caused
    // the callback. Never guess across tenants, even when one intent is newer.
    if (new Set(states.map((row) => row.organizationId)).size !== 1) {
      throw new InstallStateError(
        'More than one organization has a pending GitHub App connection. Start the connection again from the intended organization.',
      )
    }
    const state = states[0]
    if (
      state.intentKind === 'direct' &&
      (!input.userId || state.createdByUserId !== input.userId)
    ) {
      throw new InstallStateError(
        'This install state belongs to a different signed-in user.',
      )
    }
    if (
      state.intentKind === 'handoff' &&
      (state.claimedAt === null ||
        !input.userId ||
        state.claimedByUserId !== input.userId)
    ) {
      throw new InstallStateError(
        'This copied install link must be confirmed by the signed-in recipient before it can be completed.',
      )
    }
    if (state.intentKind === 'legacy') {
      throw new InstallStateError(
        'This install link predates delegated authorization. Start the connection again from Upflow Integration settings.',
      )
    }
    const existingLink = await trx
      .selectFrom('githubAppLinks')
      .select('organizationId')
      .where('installationId', '=', input.installationId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst()
    if (existingLink && existingLink.organizationId !== state.organizationId) {
      throw new InstallStateError(
        'This GitHub installation is already linked to another Upflow organization.',
      )
    }

    const stateResult = await trx
      .updateTable('githubAppInstallStates')
      .set({ consumedAt: now })
      .where('id', '=', state.id)
      .where('consumedAt', 'is', null)
      .executeTakeFirst()
    if (stateResult.numUpdatedRows !== 1n) {
      throw new InstallStateError('This install state was already used')
    }

    return {
      organizationId: state.organizationId as OrganizationId,
      stateId: state.id,
      intentKind: state.intentKind,
    }
  })
}

export async function consumeAuthorizedInstallState(input: {
  installationId: number
  nonce?: string | null
  userId?: string
}): Promise<{ organizationId: OrganizationId }> {
  const { organizationId } = await consumeAuthorizedInstallStateDetailed(input)
  return { organizationId }
}

export async function releaseConsumedInstallState(
  stateId: string,
): Promise<void> {
  await db.transaction().execute(async (trx) => {
    const state = await trx
      .selectFrom('githubAppInstallStates')
      .select(['organizationId', 'createdByUserId', 'createdAt', 'intentKind'])
      .where('id', '=', stateId)
      .where('consumedAt', 'is not', null)
      .executeTakeFirst()
    if (!state) return

    await trx
      .updateTable('githubAppInstallStates')
      .set({ consumedAt: null })
      .where('id', '=', stateId)
      .where('consumedAt', 'is not', null)
      .execute()
  })
}

/** Return the target only when this user still owns the live state. */
export async function getAuthorizedInstallStateOrganization(
  nonce: string,
  userId: string,
): Promise<OrganizationId | null> {
  const row = await db
    .selectFrom('githubAppInstallStates')
    .select('organizationId')
    .where('nonce', '=', nonce.trim())
    .where('consumedAt', 'is', null)
    .where('expiresAt', '>', new Date().toISOString())
    .where((eb) =>
      eb.or([
        eb.and([
          eb('intentKind', '=', 'direct'),
          eb('createdByUserId', '=', userId),
        ]),
        eb.and([
          eb('intentKind', '=', 'handoff'),
          eb('claimedAt', 'is not', null),
          eb('claimedByUserId', '=', userId),
        ]),
      ]),
    )
    .executeTakeFirst()
  return (row?.organizationId as OrganizationId | undefined) ?? null
}

export async function getInstallStateTarget(
  nonce: string,
  userId: string,
): Promise<{
  organizationName: string
  organizationSlug: string
}> {
  const now = new Date().toISOString()
  const row = await db
    .selectFrom('githubAppInstallStates as state')
    .innerJoin('organizations as org', 'org.id', 'state.organizationId')
    .select(['org.name as organizationName', 'org.slug as organizationSlug'])
    .where('state.nonce', '=', nonce)
    .where('state.intentKind', '=', 'handoff')
    .where('state.consumedAt', 'is', null)
    .where((eb) =>
      eb.or([
        eb('state.claimedAt', 'is', null),
        eb('state.claimedByUserId', '=', userId),
      ]),
    )
    .where('state.expiresAt', '>', now)
    .executeTakeFirst()
  if (!row) throw new InstallStateError('Invalid or expired install link')
  return row
}

/**
 * Transfer a bearer install intent to the signed-in recipient of a copied URL.
 * The nonce was created only after an Upflow owner authorized the target org.
 */
export async function claimInstallStateForUser(
  nonce: string,
  userId: string,
): Promise<void> {
  nonce = nonce.trim()
  const now = new Date().toISOString()
  const result = await db
    .updateTable('githubAppInstallStates')
    .set({ claimedByUserId: userId, claimedAt: now })
    .where('nonce', '=', nonce)
    .where('intentKind', '=', 'handoff')
    .where('consumedAt', 'is', null)
    .where('claimedAt', 'is', null)
    .where('expiresAt', '>', now)
    .executeTakeFirst()
  if (result.numUpdatedRows !== 1n) {
    const existingClaim = await db
      .updateTable('githubAppInstallStates')
      .set({ claimedAt: now })
      .where('nonce', '=', nonce)
      .where('intentKind', '=', 'handoff')
      .where('claimedByUserId', '=', userId)
      .where('claimedAt', 'is not', null)
      .where('consumedAt', 'is', null)
      .where('expiresAt', '>', now)
      .executeTakeFirst()
    if (existingClaim.numUpdatedRows !== 1n) {
      throw new InstallStateError('Invalid or expired install link')
    }
  }
}

export async function generateInstallState(
  organizationId: OrganizationId,
  userId: string,
  intentKind: 'direct' | 'handoff' = 'direct',
): Promise<string> {
  const nonce = crypto.randomUUID()
  const now = new Date().toISOString()
  const expiresAt = new Date(
    Date.now() +
      (intentKind === 'handoff' ? HANDOFF_STATE_TTL_MS : INSTALL_STATE_TTL_MS),
  ).toISOString()
  await db.transaction().execute(async (trx) => {
    if (intentKind === 'direct') {
      // A new direct attempt is the user's recovery choice. Retire older
      // direct attempts so a state-less GitHub callback is unambiguous.
      await trx
        .deleteFrom('githubAppInstallStates')
        .where('organizationId', '=', organizationId)
        .where('createdByUserId', '=', userId)
        .where('intentKind', '=', 'direct')
        .execute()
    }
    await trx
      .insertInto('githubAppInstallStates')
      .values({
        id: nanoid(),
        organizationId,
        createdByUserId: userId,
        intentKind,
        nonce,
        expiresAt,
        createdAt: now,
      })
      .execute()
    await trx
      .deleteFrom('githubAppInstallStates')
      .where('expiresAt', '<', now)
      .execute()
  })
  return nonce
}
