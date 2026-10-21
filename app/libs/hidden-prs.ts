import type { OptionalPrType } from './pr-type'

/**
 * ダッシュボードで PR を非表示にする理由。1 件の PR は、この並びで最初に該当した
 * 「有効な」理由にだけ数える (Draft の release PR を二重に数えないため)。
 */
export const HIDDEN_PR_REASONS = [
  'release',
  'template-merge',
  'dependency',
  'draft',
  'filter',
] as const satisfies readonly (OptionalPrType | 'draft' | 'filter')[]

export type HiddenPrReason = (typeof HIDDEN_PR_REASONS)[number]

export const HIDDEN_PR_REASON_LABELS: Record<HiddenPrReason, string> = {
  release: 'リリース PR',
  'template-merge': 'テンプレートのマージ',
  dependency: '依存ライブラリの更新',
  draft: 'Draft',
  filter: 'タイトル・ブランチのフィルタ',
}

export interface HiddenPrReasonCount {
  reason: HiddenPrReason
  /** 非表示にしているか (チェック状態) */
  active: boolean
  /**
   * active なら実際に隠している件数、そうでなければ有効にしたとき新たに隠れる件数。
   * どちらも、並びで手前にある有効な理由で既に隠れている PR は含まない。
   */
  count: number
}

export interface HiddenPrSummary {
  reasons: HiddenPrReasonCount[]
  /** active な理由の件数の合計 = 画面から隠れている PR の数 */
  hiddenCount: number
}
