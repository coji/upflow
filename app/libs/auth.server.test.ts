import { describe, expect, test } from 'vitest'
import { safeRedirectTo } from './auth.server'

describe('safeRedirectTo', () => {
  test('returns the path when it starts with /', () => {
    expect(safeRedirectTo('/techtalk/ongoing')).toBe('/techtalk/ongoing')
  })

  test('returns the path with query string', () => {
    expect(safeRedirectTo('/org/page?tab=1')).toBe('/org/page?tab=1')
  })

  test('returns fallback for null', () => {
    expect(safeRedirectTo(null)).toBe('/')
  })

  test('returns fallback for undefined', () => {
    expect(safeRedirectTo(undefined)).toBe('/')
  })

  test('returns fallback for empty string', () => {
    expect(safeRedirectTo('')).toBe('/')
  })

  test('rejects protocol-relative URLs (//evil.com)', () => {
    expect(safeRedirectTo('//evil.com')).toBe('/')
  })

  test('rejects absolute URLs (https://evil.com)', () => {
    expect(safeRedirectTo('https://evil.com')).toBe('/')
  })

  test('rejects relative paths without leading slash', () => {
    expect(safeRedirectTo('evil.com')).toBe('/')
  })

  test('uses custom fallback', () => {
    expect(safeRedirectTo(null, '/dashboard')).toBe('/dashboard')
  })
})
