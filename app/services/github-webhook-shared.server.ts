export function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

export type InstallationLike = {
  id: number
  account?: { id: number; login?: string; type?: string }
  repository_selection?: string
}

export function readInstallation(
  payload: Record<string, unknown>,
): InstallationLike | null {
  const inst = payload.installation
  if (!isRecord(inst) || typeof inst.id !== 'number') return null
  const acc = inst.account
  let account: { id: number; login?: string; type?: string } | undefined
  if (isRecord(acc) && typeof acc.id === 'number') {
    account = {
      id: acc.id,
      login: typeof acc.login === 'string' ? acc.login : undefined,
      type: typeof acc.type === 'string' ? acc.type : undefined,
    }
  }
  const repository_selection =
    typeof inst.repository_selection === 'string'
      ? inst.repository_selection
      : undefined
  return { id: inst.id, account, repository_selection }
}

export function selectionFromInstallation(
  installation: InstallationLike,
): 'all' | 'selected' {
  return installation.repository_selection === 'selected' ? 'selected' : 'all'
}

export async function findActiveLinkByInstallation<
  T extends import('kysely').Kysely<import('~/app/services/db.server').DB.DB>,
>(dbOrTrx: T, installationId: number) {
  return await dbOrTrx
    .selectFrom('githubAppLinks')
    .selectAll()
    .where('installationId', '=', installationId)
    .where('deletedAt', 'is', null)
    .executeTakeFirst()
}
