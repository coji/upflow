import type { Kysely } from 'kysely'
import { db } from '~/app/services/db.server'
import type { TenantDB } from '~/app/services/tenant-db.server'

type TenantKysely = Kysely<TenantDB.DB>

export interface GithubIdentity {
  /** GitHub numeric user ID (stable across login renames) */
  id: number
  login: string
}

export interface CompanyGithubUserMatch {
  login: string
  userId: string | null
  githubUserId: number | null
}

/**
 * Find the active companyGithubUsers row that belongs to this GitHub account.
 *
 * GitHub logins can be renamed and later claimed by someone else, so a login
 * alone does not identify a person:
 * - A row bound to a GitHub user ID matches only that ID.
 * - An unbound row matches by login, unless it is already linked to an Upflow
 *   user whose GitHub account has a different ID. Callers bind the ID on the
 *   first successful match (trust on first use).
 */
export async function findActiveCompanyGithubUser(
  tenantDb: TenantKysely,
  identity: GithubIdentity,
): Promise<CompanyGithubUserMatch | undefined> {
  const columns = ['login', 'userId', 'githubUserId'] as const

  const byId = await tenantDb
    .selectFrom('companyGithubUsers')
    .select(columns)
    .where('githubUserId', '=', identity.id)
    .where('isActive', '=', 1)
    .executeTakeFirst()
  if (byId) return byId

  const byLogin = await tenantDb
    .selectFrom('companyGithubUsers')
    .select(columns)
    .where((eb) =>
      eb(eb.fn('lower', ['login']), '=', identity.login.toLowerCase()),
    )
    .where('githubUserId', 'is', null)
    .where('isActive', '=', 1)
    .executeTakeFirst()
  if (!byLogin) return undefined

  if (byLogin.userId) {
    const linkedAccount = await db
      .selectFrom('accounts')
      .select('accountId')
      .where('userId', '=', byLogin.userId)
      .where('providerId', '=', 'github')
      .executeTakeFirst()
    if (linkedAccount && linkedAccount.accountId !== String(identity.id)) {
      return undefined
    }
  }
  return byLogin
}

/** Bind an unbound row to the GitHub account that matched it. */
export async function bindCompanyGithubUserId(
  tenantDb: TenantKysely,
  login: string,
  githubUserId: number,
): Promise<void> {
  await tenantDb
    .updateTable('companyGithubUsers')
    .set({ githubUserId })
    .where('login', '=', login)
    .where('githubUserId', 'is', null)
    .execute()
}
