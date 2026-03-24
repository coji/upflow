import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  assertOrgGithubAuthResolvable,
  createOctokit,
  resolveOctokitFromOrg,
} from './github-octokit.server'

describe('createOctokit', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  test('token method returns Octokit', () => {
    const o = createOctokit({ method: 'token', privateToken: 'ghp_test' })
    expect(o).toBeDefined()
  })

  test('github_app method requires env vars', () => {
    vi.stubEnv('GITHUB_APP_ID', '')
    vi.stubEnv('GITHUB_APP_PRIVATE_KEY', '')
    expect(() =>
      createOctokit({ method: 'github_app', installationId: 1 }),
    ).toThrow(/GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY/)
  })

  test('github_app method succeeds when env is set', () => {
    vi.stubEnv('GITHUB_APP_ID', '12345')
    vi.stubEnv(
      'GITHUB_APP_PRIVATE_KEY',
      Buffer.from('fake-pem').toString('base64'),
    )
    const o = createOctokit({ method: 'github_app', installationId: 99 })
    expect(o).toBeDefined()
  })
})

describe('assertOrgGithubAuthResolvable', () => {
  test('throws when no integration', () => {
    expect(() =>
      assertOrgGithubAuthResolvable({
        integration: null,
        githubAppLink: null,
      }),
    ).toThrow('No integration configured')
  })

  test('github_app without link throws', () => {
    expect(() =>
      assertOrgGithubAuthResolvable({
        integration: {
          method: 'github_app',
          privateToken: 'ghp_x',
        },
        githubAppLink: null,
      }),
    ).toThrow('GitHub App is not connected')
  })

  test('github_app with link passes', () => {
    expect(() =>
      assertOrgGithubAuthResolvable({
        integration: {
          method: 'github_app',
          privateToken: null,
        },
        githubAppLink: { installationId: 1 },
      }),
    ).not.toThrow()
  })

  test('token method without privateToken throws', () => {
    expect(() =>
      assertOrgGithubAuthResolvable({
        integration: { method: 'token', privateToken: null },
        githubAppLink: null,
      }),
    ).toThrow('No auth configured')
  })
})

describe('resolveOctokitFromOrg', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  test('token path uses PAT', () => {
    const o = resolveOctokitFromOrg({
      integration: { method: 'token', privateToken: 'ghp_abc' },
      githubAppLink: null,
    })
    expect(o).toBeDefined()
  })

  test('github_app path uses createOctokit when env set', () => {
    vi.stubEnv('GITHUB_APP_ID', '12345')
    vi.stubEnv(
      'GITHUB_APP_PRIVATE_KEY',
      Buffer.from('fake-pem').toString('base64'),
    )
    const o = resolveOctokitFromOrg({
      integration: { method: 'github_app', privateToken: null },
      githubAppLink: { installationId: 42 },
    })
    expect(o).toBeDefined()
  })
})
