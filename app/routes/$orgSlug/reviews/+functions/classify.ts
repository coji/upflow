/**
 * PRサイズ分類ユーティリティ（client/server 共用）
 */
export type PRSizeLabel = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'Unclassified'

export const PR_SIZE_LABELS = ['XS', 'S', 'M', 'L', 'XL'] as const

const PR_SIZE_RANK: Record<string, number> = {
  XS: 0,
  S: 1,
  M: 2,
  L: 3,
  XL: 4,
}

export const PR_SIZE_STYLE: Record<PRSizeLabel, string> = {
  XS: 'bg-[var(--color-chart-2)]/60 text-white',
  S: 'bg-[var(--color-chart-2)] text-white',
  M: 'bg-[var(--color-chart-1)] text-white',
  L: 'bg-[var(--color-chart-4)] text-white',
  XL: 'bg-destructive text-white',
  Unclassified: '',
}

/** LLM分類があればそちらを使い、なければ Unclassified */
export function getPRComplexity(pr: {
  complexity: string | null
}): PRSizeLabel {
  if (
    pr.complexity != null &&
    (PR_SIZE_LABELS as readonly string[]).includes(pr.complexity)
  ) {
    return pr.complexity as PRSizeLabel
  }
  return 'Unclassified'
}

/** correctedComplexity ?? complexity でソートする関数 */
export function complexitySortingFn<
  T extends { correctedComplexity: string | null; complexity: string | null },
>(a: { original: T }, b: { original: T }): number {
  const aVal = a.original.correctedComplexity ?? a.original.complexity ?? ''
  const bVal = b.original.correctedComplexity ?? b.original.complexity ?? ''
  return (PR_SIZE_RANK[aVal] ?? 5) - (PR_SIZE_RANK[bVal] ?? 5)
}
