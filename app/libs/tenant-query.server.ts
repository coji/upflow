import type { Expression, ExpressionBuilder, SqlBool } from 'kysely'
import type { HiddenPrReason } from '~/app/libs/hidden-prs'
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

export interface HiddenPrBreakdownInput {
  /** 表示に含める PR 種別。含まれない種別が非表示の理由になる */
  prTypes: readonly PrType[]
  /** その画面で種別フィルタを使うか。false なら種別の行は常に 0 */
  typesApplicable: boolean
  /** 登録済みの有効パターン。`showFiltered=1` でも件数表示のために渡す */
  enabledPatterns: readonly PrFilterPattern[]
  /** パターンで実際に隠しているか (`showFiltered=1` なら false) */
  filterActive: boolean
  /** Draft を隠しているか。undefined はその画面に Draft の切り替えがない */
  hideDrafts?: boolean
}

/**
 * 非表示理由ごとの件数を 1 回の scan で数える select 式 (`HIDDEN_PR_REASONS` の順)。
 * 各列は「その理由に該当し、手前の有効な理由には該当しない」PR の数。
 * 呼び出し側の query は種別・Draft・パターンで絞り込まず、画面の母集団だけを WHERE に置くこと。
 */
export function hiddenPrBreakdown(input: HiddenPrBreakdownInput) {
  return (eb: ExpressionBuilder<TenantDB.DB, 'pullRequests'>) => {
    const reasons: {
      reason: HiddenPrReason
      matches: Expression<SqlBool>
      active: boolean
    }[] = [
      ...(['release', 'template-merge', 'dependency'] as const).map((t) => ({
        reason: t,
        // prType は NULL (種別付与前) がありうる。`=` だと NOT (NULL = t) が NULL になり
        // 後続の理由から漏れるので、NULL を返さない `is` で比べる
        matches: input.typesApplicable
          ? eb('pullRequests.prType', 'is', t)
          : eb.lit(false),
        active: input.typesApplicable && !input.prTypes.includes(t),
      })),
      {
        reason: 'draft',
        matches:
          input.hideDrafts === undefined
            ? eb.lit(false)
            : eb('pullRequests.isDraft', '=', 1),
        active: input.hideDrafts === true,
      },
      {
        reason: 'filter',
        matches:
          input.enabledPatterns.length === 0
            ? eb.lit(false)
            : eb.not(excludePrTitleFilters(input.enabledPatterns)(eb)),
        active: input.filterActive,
      },
    ]

    const column = (index: number) => {
      const earlierActive = reasons
        .slice(0, index)
        .filter((r) => r.active)
        .map((r) => r.matches)
      const condition =
        earlierActive.length === 0
          ? reasons[index].matches
          : eb.and([reasons[index].matches, eb.not(eb.or(earlierActive))])
      return eb.fn.coalesce(
        eb.fn.sum<number>(
          eb.case().when(condition).then(eb.lit(1)).else(eb.lit(0)).end(),
        ),
        eb.lit(0),
      )
    }

    return [
      column(0).as('hiddenRelease'),
      column(1).as('hiddenTemplateMerge'),
      column(2).as('hiddenDependency'),
      column(3).as('hiddenDraft'),
      column(4).as('hiddenFilter'),
    ]
  }
}

export interface HiddenPrBreakdownRow {
  hiddenRelease: number | string
  hiddenTemplateMerge: number | string
  hiddenDependency: number | string
  hiddenDraft: number | string
  hiddenFilter: number | string
}
