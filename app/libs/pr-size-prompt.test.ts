import { describe, expect, test } from 'vitest'
import { buildOutputLanguageSection } from './pr-size-prompt'

describe('buildOutputLanguageSection', () => {
  test('returns empty string when language is undefined', () => {
    expect(buildOutputLanguageSection(undefined)).toBe('')
  })

  test('returns empty string when language is "en" (default)', () => {
    expect(buildOutputLanguageSection('en')).toBe('')
  })

  test('returns Japanese instruction for "ja"', () => {
    const result = buildOutputLanguageSection('ja')
    expect(result).toContain('<output_language>')
    expect(result).toContain('Japanese')
  })

  test('uses custom subject', () => {
    const result = buildOutputLanguageSection('ja', 'the "reason" field')
    expect(result).toContain('the "reason" field')
  })

  test('falls back to English for unknown language code', () => {
    const result = buildOutputLanguageSection('fr')
    expect(result).toContain('English')
  })
})
