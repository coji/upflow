import { z } from 'zod'

export const PR_TITLE_FILTER_PATTERN_MIN_LENGTH = 2
export const PR_TITLE_FILTER_PATTERN_MAX_LENGTH = 200

export const prTitleFilterPatternSchema = z
  .string()
  .trim()
  .min(
    PR_TITLE_FILTER_PATTERN_MIN_LENGTH,
    `pattern must be at least ${PR_TITLE_FILTER_PATTERN_MIN_LENGTH} characters`,
  )
  .max(
    PR_TITLE_FILTER_PATTERN_MAX_LENGTH,
    `pattern must be at most ${PR_TITLE_FILTER_PATTERN_MAX_LENGTH} characters`,
  )

/**
 * UNIQUE(normalized_pattern) のキーと substring match の両方に使う。
 *
 * NFC 正規化は unique 制約の防御 (結合文字の `Café` と precomposed `Café` が
 * 別 row として登録されるのを防ぐ) 目的で入れている。`matchesPattern` と SQL 側の
 * `excludePrTitleFilters` (sqlite `instr(lower(title), pattern)`) はどちらも
 * NFC 正規化しない — DB 内の titles は GitHub から取得した値がそのまま入っており、
 * 現実的な PR タイトルで NFC 差異が問題になるケースはほぼない。client preview と
 * server の match 挙動を揃えるため、match 側は NFC を適用しない。
 */
export const normalizePattern = (input: string): string =>
  input.trim().normalize('NFC').toLowerCase()

export const matchesPattern = (
  title: string,
  normalizedPattern: string,
): boolean => title.toLowerCase().includes(normalizedPattern)

/**
 * SQLite の UNIQUE 制約違反を user-facing なメッセージに翻訳する。
 * 該当しないエラーは元のメッセージを返す。
 */
export const translatePrTitleFilterError = (message: string): string => {
  if (/UNIQUE\s+constraint\s+failed/i.test(message)) {
    return 'This pattern is already registered.'
  }
  return message
}

export interface PatternCandidate {
  value: string
  label: string
  kind: 'bracket' | 'bracket-prefix' | 'colon-prefix'
}

const BRACKET_RE = /\[([^\]]+)\]/g
const BRACKET_PREFIX_RE = /^\[(\p{L}+)[-_]/u
const COLON_PREFIX_RE = /^(\p{L}+):/u

export const extractPatternCandidates = (title: string): PatternCandidate[] => {
  const candidates: PatternCandidate[] = []
  const seen = new Set<string>()

  const push = (value: string, kind: PatternCandidate['kind']) => {
    const normalized = normalizePattern(value)
    if (normalized.length < PR_TITLE_FILTER_PATTERN_MIN_LENGTH) return
    if (seen.has(normalized)) return
    seen.add(normalized)
    candidates.push({ value, label: value, kind })
  }

  for (const match of title.matchAll(BRACKET_RE)) {
    push(`[${match[1]}]`, 'bracket')

    const prefixMatch = match[0].match(BRACKET_PREFIX_RE)
    if (prefixMatch) {
      push(`[${prefixMatch[1]}-`, 'bracket-prefix')
    }
  }

  const colonMatch = title.match(COLON_PREFIX_RE)
  if (colonMatch) {
    push(`${colonMatch[1]}:`, 'colon-prefix')
  }

  return candidates
}
