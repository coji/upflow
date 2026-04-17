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

/**
 * pullRequests.title が指定の normalized pattern のいずれにもマッチしない行だけを残すフィルタ。
 * `instr(lower(title), pattern) = 0` で literal substring 判定するため、`%` や `_` が
 * ワイルドカードとして解釈される LIKE の問題を避ける。
 *
 * normalizedPatterns は trim + lowercase 済みであること (`normalizePattern()` 経由)。
 * 空配列の場合は常に true (no-op) を返す。
 */
export function excludePrTitleFilters(normalizedPatterns: readonly string[]) {
  return (eb: ExpressionBuilder<TenantDB.DB, 'pullRequests'>) => {
    if (normalizedPatterns.length === 0) {
      return eb.lit(true)
    }
    return eb.and(
      normalizedPatterns.map((pattern) =>
        eb(
          eb.fn('instr', [
            eb.fn('lower', ['pullRequests.title']),
            eb.val(pattern),
          ]),
          '=',
          0,
        ),
      ),
    )
  }
}
