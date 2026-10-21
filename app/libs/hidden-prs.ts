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
   * この理由に該当し、並びで手前にある有効な理由には該当しない PR の数。
   * active な行の合計が実際に隠れている件数になる。active でない行は、後ろの有効な
   * 理由で既に隠れている PR も含むので、チェックしても合計がその分増えるとは限らない。
   */
  count: number
}

export interface HiddenPrSummary {
  reasons: HiddenPrReasonCount[]
  /** active な理由の件数の合計 = 画面から隠れている PR の数 */
  hiddenCount: number
}
