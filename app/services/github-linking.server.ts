import { db } from '~/app/services/db.server'
import {
  type OrganizationId,
  getTenantDb,
} from '~/app/services/tenant-db.server'

/**
 * GitHub ログイン後に companyGithubUsers.userId を自動紐付けする。
 * accounts テーブルの accessToken で GitHub API を呼び、login (username) を取得。
 * ユーザーが所属する全 org の tenant DB で、login が一致するレコードの userId を設定する。
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
  })

  if (!res.ok) {
    return
  }

  const profile = (await res.json()) as { login: string }
  if (!profile.login) {
    return
  }

  const memberships = await db
    .selectFrom('members')
    .select(['organizationId'])
    .where('userId', '=', userId)
    .execute()

  if (memberships.length === 0) {
    return
  }

  await Promise.allSettled(
    memberships.map(async ({ organizationId }) => {
      const tenantDb = getTenantDb(organizationId as OrganizationId)
      await tenantDb
        .updateTable('companyGithubUsers')
        .set({ userId })
        .where('login', '=', profile.login)
        .where('userId', 'is', null)
        .execute()
    }),
  )
}
