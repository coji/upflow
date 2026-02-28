import { nanoid } from 'nanoid'
import { db } from '~/app/services/db.server'
import {
  type OrganizationId,
  getTenantDb,
} from '~/app/services/tenant-db.server'

/**
 * GitHub ログイン後の自動処理:
 * 1. companyGithubUsers に login が登録されている org を探す
 * 2. その org のメンバーでなければ自動追加
 * 3. companyGithubUsers.userId を自動設定（PR author との紐付け）
 */
export async function linkGithubUserToCompanyUsers(
  userId: string,
): Promise<void> {
  const githubAccount = await db
    .selectFrom('accounts')
    .select(['accessToken'])
    .where('userId', '=', userId)
    .where('providerId', '=', 'github')
    .executeTakeFirst()

  if (!githubAccount?.accessToken) {
    return
  }

  const res = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${githubAccount.accessToken}`,
      'User-Agent': 'upflow',
      Accept: 'application/vnd.github+json',
    },
    signal: AbortSignal.timeout(5_000),
  })

  if (!res.ok) {
    return
  }

  const profile = (await res.json()) as { login: string }
  if (!profile.login) {
    return
  }

  const loginLower = profile.login.toLowerCase()

  // Find all orgs where this GitHub login is registered in companyGithubUsers
  const orgs = await db.selectFrom('organizations').select(['id']).execute()

  for (const { id: orgId } of orgs) {
    try {
      const tenantDb = getTenantDb(orgId as OrganizationId)
      const match = await tenantDb
        .selectFrom('companyGithubUsers')
        .select(['login'])
        .where((eb) => eb(eb.fn('lower', ['login']), '=', loginLower))
        .where('isActive', '=', 1)
        .executeTakeFirst()

      if (!match) {
        continue
      }

      // Set userId on companyGithubUsers if not already set
      await tenantDb
        .updateTable('companyGithubUsers')
        .set({ userId })
        .where((eb) => eb(eb.fn('lower', ['login']), '=', loginLower))
        .where('userId', 'is', null)
        .execute()

      // Auto-add as org member if not already a member.
      // Check-then-insert with a try/catch guard for concurrent races
      // (members table has no unique constraint on org+user).
      const existingMember = await db
        .selectFrom('members')
        .select(['id'])
        .where('organizationId', '=', orgId)
        .where('userId', '=', userId)
        .executeTakeFirst()

      if (!existingMember) {
        try {
          await db
            .insertInto('members')
            .values({
              id: nanoid(),
              organizationId: orgId,
              userId,
              role: 'member',
              createdAt: new Date().toISOString(),
            })
            .execute()
          console.info(
            `[GitHub linking] Auto-added user ${userId} to org ${orgId}`,
          )
        } catch {
          // Concurrent insert — member already exists, safe to ignore
        }
      }
    } catch (error) {
      console.warn(`[GitHub linking] Failed to process org ${orgId}:`, error)
    }
  }
}
