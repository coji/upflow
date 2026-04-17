import { describe, expect, it } from 'vitest'
import { extractFormError } from './form-error'

describe('extractFormError', () => {
  it('returns undefined when data is null/undefined', () => {
    expect(extractFormError(undefined)).toBeUndefined()
    expect(extractFormError(null)).toBeUndefined()
  })

  it('returns undefined when lastResult is missing', () => {
    expect(extractFormError({})).toBeUndefined()
  })

  it('returns undefined when error is missing', () => {
    expect(extractFormError({ lastResult: {} })).toBeUndefined()
    expect(extractFormError({ lastResult: { error: null } })).toBeUndefined()
  })

  it('returns undefined when form-level error array is absent', () => {
    expect(
      extractFormError({
        lastResult: { error: { pattern: ['field error'] } },
      }),
    ).toBeUndefined()
  })

  it('returns the first form-level error (conform empty-string key)', () => {
    expect(
      extractFormError({
        lastResult: { error: { '': ['first', 'second'] } },
      }),
    ).toBe('first')
  })
})
