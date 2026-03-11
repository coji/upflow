import { describe, expect, test } from 'vitest'
import { complexitySortingFn, getPRComplexity } from './classify'

describe('getPRComplexity', () => {
  test('uses LLM complexity when available', () => {
    expect(getPRComplexity({ complexity: 'L' })).toBe('L')
  })

  test('returns Unclassified when complexity is null', () => {
    expect(getPRComplexity({ complexity: null })).toBe('Unclassified')
  })

  test('returns Unclassified when complexity is invalid', () => {
    expect(getPRComplexity({ complexity: 'INVALID' })).toBe('Unclassified')
  })

  test.each(['XS', 'S', 'M', 'L', 'XL'] as const)(
    'accepts valid label %s',
    (label) => {
      expect(getPRComplexity({ complexity: label })).toBe(label)
    },
  )
})

describe('complexitySortingFn', () => {
  const row = (
    complexity: string | null,
    correctedComplexity: string | null = null,
  ) => ({
    original: { complexity, correctedComplexity },
  })

  test('sorts by complexity rank', () => {
    expect(complexitySortingFn(row('XS'), row('XL'))).toBeLessThan(0)
    expect(complexitySortingFn(row('XL'), row('XS'))).toBeGreaterThan(0)
    expect(complexitySortingFn(row('M'), row('M'))).toBe(0)
  })

  test('prefers correctedComplexity over complexity', () => {
    // corrected=XS should sort before complexity=XL
    expect(complexitySortingFn(row('XL', 'XS'), row('S'))).toBeLessThan(0)
  })

  test('null complexity sorts last', () => {
    expect(complexitySortingFn(row(null), row('XS'))).toBeGreaterThan(0)
  })
})
