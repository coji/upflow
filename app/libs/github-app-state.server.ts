import { nanoid } from 'nanoid'
import { db } from '~/app/services/db.server'
import type { OrganizationId } from '~/app/types/organization'

const INSTALL_STATE_TTL_MS = 7 * 24 * 60 * 60 * 1000

export class InstallStateError extends Error {
  override readonly name = 'InstallStateError'
}

export async function generateInstallState(
  organizationId: OrganizationId,
): Promise<string> {
  const nonce = crypto.randomUUID()
  const now = new Date().toISOString()
  const expiresAt = new Date(Date.now() + INSTALL_STATE_TTL_MS).toISOString()
  await db
    .insertInto('githubAppInstallStates')
    .values({
      id: nanoid(),
      organizationId,
      nonce,
      expiresAt,
    })
    .execute()
  // Piggyback cleanup: remove expired/consumed states
  await db
    .deleteFrom('githubAppInstallStates')
    .where('expiresAt', '<', now)
    .execute()
  return nonce
}

export async function consumeInstallState(
  nonce: string,
): Promise<{ organizationId: OrganizationId }> {
  const now = new Date().toISOString()
  const row = await db
    .updateTable('githubAppInstallStates')
    .set({ consumedAt: now })
    .where('nonce', '=', nonce)
    .where('consumedAt', 'is', null)
    .where('expiresAt', '>', now)
    .returning('organizationId')
    .executeTakeFirst()

  if (!row) {
    throw new InstallStateError(
      'Invalid, expired, or already used install state',
    )
  }

  return { organizationId: row.organizationId as OrganizationId }
}
