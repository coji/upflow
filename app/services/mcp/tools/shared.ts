import { z } from 'zod'

/** 共通フィルタパラメータ */
export const periodSchema = z
  .enum(['7d', '14d', '30d', '90d', '180d', '365d'])
  .default('30d')
  .describe('集計期間')

export const teamSchema = z
  .string()
  .optional()
  .describe('チーム名でフィルタ。省略時は全チーム')

export const repoSchema = z
  .string()
  .optional()
  .describe('リポジトリ名でフィルタ（owner/repo 形式）。省略時は全リポジトリ')

/** period 文字列を日数に変換 */
export const parsePeriodDays = (period: string): number => {
  const match = period.match(/^(\d+)d$/)
  return match ? Number(match[1]) : 30
}

/** period から since の ISO 文字列を生成 */
export const sinceFromPeriod = (period: string): string => {
  const days = parsePeriodDays(period)
  return new Date(Date.now() - days * 86400000).toISOString()
}

/** 数値配列のパーセンタイルを計算 */
export const percentile = (values: number[], p: number): number | null => {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const idx = Math.ceil(sorted.length * p) - 1
  return Number(sorted[Math.max(0, idx)].toFixed(2))
}

/** 数値配列の平均 */
export const avg = (values: (number | null)[]): number | null => {
  const nums = values.filter((v): v is number => v != null)
  if (nums.length === 0) return null
  return Number((nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2))
}

/** MCP tool のレスポンスを生成 */
export const jsonResponse = (data: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
})
