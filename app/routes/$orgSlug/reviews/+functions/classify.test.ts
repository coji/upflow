import { describe, expect, test } from 'vitest'
import { classifyPRSize, getPRComplexity } from './classify'

describe('classifyPRSize', () => {
  test.each([
    { additions: 5, deletions: 3, expected: 'XS' },
    { additions: 30, deletions: 10, expected: 'S' },
    { additions: 100, deletions: 50, expected: 'M' },
    { additions: 300, deletions: 100, expected: 'L' },
    { additions: 400, deletions: 200, expected: 'XL' },
    { additions: null, deletions: null, expected: 'XS' },
  ])(
    '$additions+$deletions => $expected',
    ({ additions, deletions, expected }) => {
      expect(classifyPRSize(additions, deletions)).toBe(expected)
    },
  )
})

describe('getPRComplexity', () => {
  test('uses LLM complexity when available', () => {
    expect(
      getPRComplexity({ complexity: 'L', additions: 5, deletions: 3 }),
    ).toBe('L')
  })

  test('falls back to rule-based when complexity is null', () => {
    expect(
      getPRComplexity({ complexity: null, additions: 5, deletions: 3 }),
    ).toBe('XS')
  })

  test('falls back to rule-based when complexity is invalid', () => {
    expect(
      getPRComplexity({ complexity: 'INVALID', additions: 100, deletions: 50 }),
    ).toBe('M')
  })
})
