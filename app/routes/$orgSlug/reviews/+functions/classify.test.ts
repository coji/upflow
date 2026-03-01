import { describe, expect, test } from 'vitest'
import { getPRComplexity } from './classify'

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
