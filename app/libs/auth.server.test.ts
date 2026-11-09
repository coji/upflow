import SQLite from 'better-sqlite3'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { getIP } from 'better-auth/api'
import { afterAll, describe, expect, test, vi } from 'vitest'

const dataDir = mkdtempSync(path.join(tmpdir(), 'auth-test-'))
vi.stubEnv('UPFLOW_DATA_DIR', dataDir)
// Better Auth 1.7 validates the schema before serving even an anonymous request.
const database = new SQLite(path.join(dataDir, 'data.db'))
database.exec(
  readFileSync(new URL('../../db/shared.sql', import.meta.url), 'utf8'),
)
database.close()

afterAll(async () => {
  const { closeDb } = await import('../services/db.server')
  await closeDb()
  rmSync(dataDir, { recursive: true, force: true })
})

// Import after env stub to avoid resolveDataDir() throwing
const { auth, getSession, safeRedirectTo } = await import('./auth.server')

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

describe('getSession', () => {
  test('accepts a Request without throwing (Better Auth requires plain headers)', async () => {
    const request = new Request('http://localhost/')
    await expect(getSession(request)).resolves.toBeNull()
  })
})

describe('GitHub profile mapping', () => {
  test('keeps the provider identity in raw data, separate from local user fields', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        Response.json({
          id: 123,
          login: 'example-user',
          name: 'Example User',
          email: 'example@example.com',
          avatar_url: 'https://example.com/avatar.png',
        }),
      )
      .mockResolvedValueOnce(
        Response.json([
          { email: 'example@example.com', primary: true, verified: true },
        ]),
      )
    try {
      const result = await auth.options.socialProviders.github.getUserInfo({
        accessToken: 'test-access-token',
      })
      expect(result?.data.id).toBe(123)
      expect(result?.user).toEqual({
        name: 'Example User',
        email: 'example@example.com',
        image: 'https://example.com/avatar.png',
        emailVerified: true,
      })
    } finally {
      fetchMock.mockRestore()
    }
  })
})

describe('client IP resolution behind Fly', () => {
  test('uses Fly-Client-IP even when X-Forwarded-For is multi-hop', () => {
    const headers = new Headers({
      'fly-client-ip': '203.0.113.5',
      'x-forwarded-for': '203.0.113.5, 198.51.100.7',
    })
    expect(getIP(headers, auth.options)).toBe('203.0.113.5')
  })
})
