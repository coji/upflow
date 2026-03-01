/**
 * PRサイズ分類ユーティリティ（client/server 共用）
 */
export type PRSizeLabel = 'XS' | 'S' | 'M' | 'L' | 'XL'

const VALID_LABELS: PRSizeLabel[] = ['XS', 'S', 'M', 'L', 'XL']

/** ルールベース分類（additions+deletions のみ） */
export function classifyPRSize(
  additions: number | null,
  deletions: number | null,
): PRSizeLabel {
  const total = (additions ?? 0) + (deletions ?? 0)
  if (total <= 10) return 'XS'
  if (total <= 50) return 'S'
  if (total <= 200) return 'M'
  if (total <= 500) return 'L'
  return 'XL'
}

/** LLM分類があればそちらを使い、なければルールベースにフォールバック */
export function getPRComplexity(pr: {
  complexity: string | null
  additions: number | null
  deletions: number | null
}): PRSizeLabel {
  if (
    pr.complexity != null &&
    VALID_LABELS.includes(pr.complexity as PRSizeLabel)
  ) {
    return pr.complexity as PRSizeLabel
  }
  return classifyPRSize(pr.additions, pr.deletions)
}
