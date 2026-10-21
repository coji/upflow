import type { ExpressionBuilder } from 'kysely'
import { PR_TYPES, type PrType } from '~/app/libs/pr-type'
import type { PrFilterPattern } from '~/app/libs/pr-title-filter'
import type * as TenantDB from '~/app/services/tenant-type'

/** 集計クエリの既定の PR 種別 (#429)。release / template-merge / dependency は除く */
export const DEFAULT_ALLOWED_PR_TYPES: readonly PrType[] = ['normal']

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
 * PR filter のパターンのいずれにもマッチしない行だけを残すフィルタ。target が
 * title なら pullRequests.title、branch なら pullRequests.sourceBranch と照合する。
 * `instr(lower(column), pattern) = 0` で literal substring 判定するため、`%` や `_` が
 * ワイルドカードとして解釈される LIKE の問題を避ける。
 *
 * pattern は trim + lowercase 済みであること (`normalizePattern()` 経由)。
 * 空配列の場合は常に true (no-op) を返す。
 */
export function excludePrTitleFilters(patterns: readonly PrFilterPattern[]) {
  return (eb: ExpressionBuilder<TenantDB.DB, 'pullRequests'>) => {
    if (patterns.length === 0) {
      return eb.lit(true)
    }
    return eb.and(
      patterns.map(({ target, pattern }) =>
        eb(
          eb.fn('instr', [
            eb.fn('lower', [
              target === 'branch'
                ? 'pullRequests.sourceBranch'
                : 'pullRequests.title',
            ]),
            eb.val(pattern),
          ]),
          '=',
          0,
        ),
      ),
    )
  }
}

/**
 * `excludePrTitleFilters` と対になる filtered 件数の集計式。
 *
 * `SUM(CASE WHEN <no-match-predicate> THEN 1 ELSE 0 END)` を 1 クエリ内で
 * 評価することで、unfiltered / filtered の 2 回 scan を 1 回に纏められる。
 * `countAll()` (unfiltered) と組み合わせて select に並べることで、
 * バナー用 excludedCount を単一 query で計算できる。
 *
 * normalizedPatterns 空の場合は countAll() と同じ値を返す (filtered = unfiltered)。
 */
export function filteredPullRequestCount(
  normalizedPatterns: readonly PrFilterPattern[],
) {
  return (eb: ExpressionBuilder<TenantDB.DB, 'pullRequests'>) =>
    eb.fn.coalesce(
      eb.fn.sum<number>(
        eb
          .case()
          .when(excludePrTitleFilters(normalizedPatterns)(eb))
          .then(eb.lit(1))
          .else(eb.lit(0))
          .end(),
      ),
      eb.lit(0),
    )
}

/**
 * pullRequests.prType が allowed に含まれる行だけを残すフィルタ (#429)。
 * prType が NULL の行 (種別付与前) は normal として扱い、常に通す。
 */
export function filterPrTypes(allowed: readonly PrType[]) {
  return (eb: ExpressionBuilder<TenantDB.DB, 'pullRequests'>) => {
    if (PR_TYPES.every((t) => allowed.includes(t))) {
      return eb.lit(true)
    }
    return eb.or([
      eb('pullRequests.prType', 'is', null),
      eb('pullRequests.prType', 'in', [...allowed]),
    ])
  }
}
