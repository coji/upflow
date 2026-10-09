import { describe, expect, test } from 'vitest'
import { resolveForwardedUrl } from './forwarded-url.mjs'

describe('resolveForwardedUrl', () => {
  test('returns the https URL when the proxy reports https', () => {
    expect(
      resolveForwardedUrl('/org/settings?tab=1', {
        host: 'upflow.example.com',
        'x-forwarded-proto': 'https',
      }),
    ).toBe('https://upflow.example.com/org/settings?tab=1')
  })

  test.each([
    ['http', { host: 'upflow.example.com', 'x-forwarded-proto': 'http' }],
    [
      'a proto list',
      { host: 'upflow.example.com', 'x-forwarded-proto': 'https, http' },
    ],
    ['no proto header', { host: 'upflow.example.com' }],
    ['no host header', { 'x-forwarded-proto': 'https' }],
  ])('keeps the default URL for %s', (_label, headers) => {
    expect(resolveForwardedUrl('/', headers)).toBeNull()
  })

  test('keeps an already absolute request URL', () => {
    expect(
      resolveForwardedUrl('http://other.example.com/', {
        host: 'upflow.example.com',
        'x-forwarded-proto': 'https',
      }),
    ).toBeNull()
  })
})
