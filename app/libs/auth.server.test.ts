import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, test, vi } from 'vitest'

vi.stubEnv('UPFLOW_DATA_DIR', mkdtempSync(path.join(tmpdir(), 'auth-test-')))

// Import after env stub to avoid resolveDataDir() throwing
const { safeRedirectTo } = await import('./auth.server')

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

  test('rejects backslash-prefixed URLs (/\\evil.com)', () => {
    expect(safeRedirectTo('/\\evil.com')).toBe('/')
  })

  test('rejects absolute URLs (https://evil.com)', () => {
    expect(safeRedirectTo('https://evil.com')).toBe('/')
  })

  test('rejects relative paths without leading slash', () => {
    expect(safeRedirectTo('evil.com')).toBe('/')
  })

  test('accepts root path', () => {
    expect(safeRedirectTo('/')).toBe('/')
  })

  test('accepts path with hash fragment', () => {
    expect(safeRedirectTo('/page#section')).toBe('/page#section')
  })

  test('rejects javascript: scheme', () => {
    expect(safeRedirectTo('javascript:alert(1)')).toBe('/')
  })

  test('rejects data: scheme', () => {
    expect(safeRedirectTo('data:text/html,<h1>hi</h1>')).toBe('/')
  })

  test('rejects URLs with leading space', () => {
    expect(safeRedirectTo(' /evil')).toBe('/')
  })

  test('uses custom fallback', () => {
    expect(safeRedirectTo(null, '/dashboard')).toBe('/dashboard')
  })
})
