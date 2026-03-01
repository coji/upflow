/**
 * PRサイズ分類ユーティリティ（client/server 共用）
 */
export type PRSizeLabel = 'XS' | 'S' | 'M' | 'L' | 'XL'

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
