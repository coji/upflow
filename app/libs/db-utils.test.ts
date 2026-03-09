import { describe, expect, it } from 'vitest'
import { calcPagination, escapeLike } from './db-utils'

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

describe('calcPagination', () => {
  it('calculates basic pagination', () => {
    expect(calcPagination(100, 1, 10)).toEqual({
      currentPage: 1,
      pageSize: 10,
      totalPages: 10,
      totalItems: 100,
    })
  })

  it('clamps currentPage to totalPages', () => {
    expect(calcPagination(5, 3, 10)).toEqual({
      currentPage: 1,
      pageSize: 10,
      totalPages: 1,
      totalItems: 5,
    })
  })

  it('returns 1 page for zero items', () => {
    expect(calcPagination(0, 1, 10)).toEqual({
      currentPage: 1,
      pageSize: 10,
      totalPages: 1,
      totalItems: 0,
    })
  })
})
