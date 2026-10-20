import { describe, expect, test } from 'vitest'
import {
  parseIncludedPrTypes,
  setIncludedPrTypes,
  toAllowedPrTypes,
} from './pr-type-filter'

describe('pr type filter params', () => {
  test('defaults to no optional types', () => {
    expect(parseIncludedPrTypes(new URLSearchParams())).toEqual([])
    expect(toAllowedPrTypes([])).toEqual(['normal'])
  })

  test('parses known types and ignores unknown ones', () => {
    expect(
      parseIncludedPrTypes(
        new URLSearchParams('prTypes=dependency,bogus,release'),
      ),
    ).toEqual(['release', 'dependency'])
  })

  test('normal cannot be toggled through the param', () => {
    expect(parseIncludedPrTypes(new URLSearchParams('prTypes=normal'))).toEqual(
      [],
    )
  })

  test('writes a canonical order and drops the param when empty', () => {
    const params = new URLSearchParams('from=2026-10-01')
    setIncludedPrTypes(params, ['dependency', 'release'])
    expect(params.get('prTypes')).toBe('release,dependency')
    setIncludedPrTypes(params, [])
    expect(params.has('prTypes')).toBe(false)
    expect(params.get('from')).toBe('2026-10-01')
  })
})
