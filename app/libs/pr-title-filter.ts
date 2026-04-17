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

export const normalizePattern = (input: string): string =>
  input.trim().toLowerCase()

export const matchesPattern = (
  title: string,
  normalizedPattern: string,
): boolean => title.toLowerCase().includes(normalizedPattern)

export interface PatternCandidate {
  value: string
  label: string
  kind: 'bracket' | 'bracket-prefix' | 'colon-prefix'
}

const BRACKET_RE = /\[([^\]]+)\]/g
const BRACKET_PREFIX_RE = /^\[([A-Za-z]+)[-_]/
const COLON_PREFIX_RE = /^([A-Za-z]+):/

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
