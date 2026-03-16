import type { ExpressionBuilder } from 'kysely'
import type * as TenantDB from '~/app/services/tenant-type'

/**
 * companyGithubUsers.type が Bot でない行のみ残すフィルタ。
 * LEFT JOIN で companyGithubUsers に結合している前提で使う。
 * NULL（未登録ユーザー）も通す。
 */
export function excludeBots(
  eb: ExpressionBuilder<
    TenantDB.DB & { companyGithubUsers: TenantDB.CompanyGithubUsers },
    keyof TenantDB.DB | 'companyGithubUsers'
  >,
) {
  return eb.or([
    eb('companyGithubUsers.type', 'is', null),
    eb('companyGithubUsers.type', '!=', 'Bot'),
  ])
}
