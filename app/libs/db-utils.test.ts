import { describe, expect, it } from 'vitest'
import { escapeLike } from './db-utils'

describe('escapeLike', () => {
  it('returns plain strings unchanged', () => {
    expect(escapeLike('hello')).toBe('hello')
  })

  it('escapes percent signs', () => {
    expect(escapeLike('100%')).toBe('100\\%')
  })

  it('escapes underscores', () => {
    expect(escapeLike('my_repo')).toBe('my\\_repo')
  })

  it('escapes backslashes', () => {
    expect(escapeLike('path\\to')).toBe('path\\\\to')
  })

  it('escapes multiple special characters', () => {
    expect(escapeLike('%_\\')).toBe('\\%\\_\\\\')
  })

  it('handles empty string', () => {
    expect(escapeLike('')).toBe('')
  })
})
