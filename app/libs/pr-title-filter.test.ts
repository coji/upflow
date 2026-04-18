import { describe, expect, it } from 'vitest'
import {
  extractPatternCandidates,
  matchesPattern,
  normalizePattern,
  prTitleFilterPatternSchema,
  translatePrTitleFilterError,
} from './pr-title-filter'

describe('normalizePattern', () => {
  it('trims and lowercases', () => {
    expect(normalizePattern('  [WIP]  ')).toBe('[wip]')
  })

  it('NFC-normalizes so combining vs precomposed forms collapse to one key', () => {
    // 'é' precomposed (U+00E9) vs 'e' + combining acute (U+0065 U+0301)
    const precomposed = 'Caf\u00e9'
    const decomposed = 'Cafe\u0301'
    expect(precomposed).not.toBe(decomposed)
    expect(normalizePattern(precomposed)).toBe(normalizePattern(decomposed))
  })
})

describe('prTitleFilterPatternSchema', () => {
  it('accepts a valid pattern', () => {
    expect(prTitleFilterPatternSchema.parse('[DO NOT MERGE]')).toBe(
      '[DO NOT MERGE]',
    )
  })

  it('trims leading/trailing whitespace', () => {
    expect(prTitleFilterPatternSchema.parse('  [WIP]  ')).toBe('[WIP]')
  })

  it('rejects empty string', () => {
    expect(() => prTitleFilterPatternSchema.parse('')).toThrow()
  })

  it('rejects pure whitespace', () => {
    expect(() => prTitleFilterPatternSchema.parse('   ')).toThrow()
  })

  it('rejects a single-character pattern', () => {
    expect(() => prTitleFilterPatternSchema.parse('[')).toThrow()
  })

  it('rejects patterns longer than 200 chars', () => {
    const long = 'a'.repeat(201)
    expect(() => prTitleFilterPatternSchema.parse(long)).toThrow()
  })
})

describe('matchesPattern', () => {
  it('matches substring case-insensitively', () => {
    expect(matchesPattern('[DO NOT MERGE] fix', '[do not merge]')).toBe(true)
    expect(matchesPattern('[do not merge] fix', '[do not merge]')).toBe(true)
  })

  it('treats % as literal', () => {
    expect(matchesPattern('coverage 100% complete', '100%')).toBe(true)
    expect(matchesPattern('coverage complete', '100%')).toBe(false)
  })

  it('treats _ as literal', () => {
    expect(matchesPattern('PR_123 update', 'pr_123')).toBe(true)
    expect(matchesPattern('PR1X23 update', 'pr_123')).toBe(false)
  })

  it('returns false when pattern not found', () => {
    expect(matchesPattern('[WIP] hello', '[done]')).toBe(false)
  })
})

describe('extractPatternCandidates', () => {
  it('extracts bracket blocks verbatim', () => {
    const candidates = extractPatternCandidates('[DO NOT MERGE] fix typo')
    expect(candidates.map((c) => c.value)).toContain('[DO NOT MERGE]')
  })

  it('extracts both specific and prefix forms for prefixed brackets', () => {
    const candidates = extractPatternCandidates('[EPIC-123] refactor')
    const values = candidates.map((c) => c.value)
    expect(values).toContain('[EPIC-123]')
    expect(values).toContain('[EPIC-')
  })

  it('extracts multiple brackets', () => {
    const candidates = extractPatternCandidates('[DO NOT MERGE][EPIC-99] fix')
    const values = candidates.map((c) => c.value)
    expect(values).toContain('[DO NOT MERGE]')
    expect(values).toContain('[EPIC-99]')
    expect(values).toContain('[EPIC-')
  })

  it('extracts leading colon prefix', () => {
    const candidates = extractPatternCandidates('WIP: refactor component')
    expect(candidates.map((c) => c.value)).toContain('WIP:')
  })

  it('does not extract colon prefix from non-leading position', () => {
    const candidates = extractPatternCandidates('fix: WIP: in-body')
    expect(candidates.map((c) => c.value)).toEqual(['fix:'])
  })

  it('dedupes by normalized form', () => {
    const candidates = extractPatternCandidates('[WIP] [wip] fix')
    const wipCount = candidates.filter(
      (c) => c.value.toLowerCase() === '[wip]',
    ).length
    expect(wipCount).toBe(1)
  })

  it('returns empty array when no candidates match', () => {
    const candidates = extractPatternCandidates('plain title without markers')
    expect(candidates).toEqual([])
  })

  it('extracts Japanese bracket prefix', () => {
    const candidates = extractPatternCandidates(
      '[機能追加-001] ログイン画面の修正',
    )
    const values = candidates.map((c) => c.value)
    expect(values).toContain('[機能追加-001]')
    expect(values).toContain('[機能追加-')
  })

  it('extracts Japanese colon prefix', () => {
    const candidates = extractPatternCandidates('機能追加: ログイン画面')
    expect(candidates.map((c) => c.value)).toContain('機能追加:')
  })

  it('extracts accented bracket prefix', () => {
    const candidates = extractPatternCandidates('[Café-42] update')
    const values = candidates.map((c) => c.value)
    expect(values).toContain('[Café-42]')
    expect(values).toContain('[Café-')
  })

  it('extracts prefix with mixed ASCII and CJK letters', () => {
    const candidates = extractPatternCandidates('[EPIC機能-001] refactor')
    const values = candidates.map((c) => c.value)
    expect(values).toContain('[EPIC機能-001]')
    expect(values).toContain('[EPIC機能-')
  })

  it('does not extract prefix starting with emoji', () => {
    const candidates = extractPatternCandidates('[🚀 release] deploy')
    const values = candidates.map((c) => c.value)
    expect(values).toContain('[🚀 release]')
    expect(values.some((v) => v.endsWith('-'))).toBe(false)
  })
})

describe('translatePrTitleFilterError', () => {
  it('translates SQLite UNIQUE constraint violation', () => {
    expect(
      translatePrTitleFilterError(
        'SQLITE_CONSTRAINT: UNIQUE constraint failed: pr_title_filters.normalized_pattern',
      ),
    ).toBe('This pattern is already registered.')
  })

  it('passes through unrelated errors unchanged', () => {
    expect(translatePrTitleFilterError('some other error')).toBe(
      'some other error',
    )
  })
})
