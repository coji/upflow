import { describe, expect, test } from 'vitest'
import {
  clearHandoffCookie,
  getGithubHandoffState,
  handoffCookieForRedirect,
  runWithGithubHandoff,
} from './github-handoff-auth.server'

describe('GitHub handoff authentication context', () => {
  test('creates a scoped cookie only for a delegated GitHub route', () => {
    expect(
      handoffCookieForRedirect('/api/github/install?state=secret'),
    ).toContain('upflow_github_handoff=secret')
    expect(handoffCookieForRedirect('/settings?state=secret')).toBeNull()
  })

  test('exposes the requested nonce only inside its authentication request', async () => {
    const request = new Request('http://x/api/auth/callback/github', {
      headers: { Cookie: 'upflow_github_handoff=secret' },
    })
    await runWithGithubHandoff(request, async () => {
      expect(getGithubHandoffState()).toBe('secret')
    })
    expect(getGithubHandoffState()).toBeNull()
  })

  test('ignores a malformed cookie instead of breaking authentication', async () => {
    const request = new Request('http://x/api/auth/callback/github', {
      headers: { Cookie: 'upflow_github_handoff=%' },
    })
    await runWithGithubHandoff(request, async () => {
      expect(getGithubHandoffState()).toBeNull()
    })
  })

  test('clears the production cookie with the same Secure attribute', () => {
    const previous = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    try {
      expect(clearHandoffCookie()).toContain('; Secure')
    } finally {
      process.env.NODE_ENV = previous
    }
  })
})
