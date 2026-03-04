/**
 * PRサイズ分類ユーティリティ（client/server 共用）
 */
export type PRSizeLabel = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'Unclassified'

const VALID_LABELS: readonly string[] = ['XS', 'S', 'M', 'L', 'XL']

/** LLM分類があればそちらを使い、なければ Unclassified */
export function getPRComplexity(pr: {
  complexity: string | null
}): PRSizeLabel {
  if (pr.complexity != null && VALID_LABELS.includes(pr.complexity)) {
    return pr.complexity as PRSizeLabel
  }
  return 'Unclassified'
}
