/**
 * PRサイズ分類ユーティリティ（client/server 共用）
 */

/** 実際の5段階サイズ */
export type PRSize = 'XS' | 'S' | 'M' | 'L' | 'XL'

/** 表示用（未分類を含む） */
export type PRSizeLabel = PRSize | 'Unclassified'

export const PR_SIZE_LABELS = ['XS', 'S', 'M', 'L', 'XL'] as const

export const PR_SIZE_RANK: Record<string, number> = {
  XS: 0,
  S: 1,
  M: 2,
  L: 3,
  XL: 4,
}

export const PR_SIZE_STYLE: Record<PRSizeLabel, string> = {
  XS: 'bg-slate-400 text-white',
  S: 'bg-emerald-500 text-white',
  M: 'bg-blue-500 text-white',
  L: 'bg-amber-500 text-white',
  XL: 'bg-destructive text-white',
  Unclassified: '',
}

/** チャート用カラー（CSS値） */
export const PR_SIZE_COLORS: Record<PRSizeLabel, string> = {
  XS: 'oklch(0.65 0.01 264)',
  S: 'oklch(0.65 0.2 160)',
  M: 'oklch(0.55 0.2 260)',
  L: 'oklch(0.75 0.18 80)',
  XL: 'var(--color-destructive)',
  Unclassified: 'var(--color-muted-foreground)',
}

/** サイズ定義の短い説明 */
export const PR_SIZE_DESCRIPTION: Record<PRSize, string> = {
  XS: '認知負荷ほぼゼロ。機械的・局所的な変更',
  S: '低い認知負荷。単一の関心事で確認が容易',
  M: '中程度の認知負荷。1コンポーネント内で完結',
  L: '高い認知負荷。複数コンポーネント or リスク領域',
  XL: '非常に高い認知負荷。システム全体の理解が必要',
}

/** 補正済みサイズ → LLM分類 → Unclassified の優先順で返す */
export function getPRComplexity(pr: {
  complexity: string | null
  correctedComplexity?: string | null
}): PRSizeLabel {
  const value = pr.correctedComplexity ?? pr.complexity
  if (value != null && (PR_SIZE_LABELS as readonly string[]).includes(value)) {
    return value as PRSizeLabel
  }
  return 'Unclassified'
}

/** riskAreas フィールド（JSON配列 or カンマ区切り文字列）をパースする */
export function parseRiskAreas(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String)
  if (typeof raw !== 'string') return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.map(String)
  } catch {
    // not JSON — split by comma
  }
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

/** correctedComplexity ?? complexity でソートする関数 */
export function complexitySortingFn<
  T extends { correctedComplexity: string | null; complexity: string | null },
>(a: { original: T }, b: { original: T }): number {
  const aVal = a.original.correctedComplexity ?? a.original.complexity ?? ''
  const bVal = b.original.correctedComplexity ?? b.original.complexity ?? ''
  return (PR_SIZE_RANK[aVal] ?? 5) - (PR_SIZE_RANK[bVal] ?? 5)
}
