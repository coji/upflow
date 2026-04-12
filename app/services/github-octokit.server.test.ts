import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  createAppOctokit,
  createOctokit,
  resolveOctokitForInstallation,
  resolveOctokitForRepository,
} from './github-octokit.server'

const stubGithubAppEnv = () => {
  vi.stubEnv('GITHUB_APP_ID', '12345')
  vi.stubEnv(
    'GITHUB_APP_PRIVATE_KEY',
    Buffer.from('fake-pem').toString('base64'),
  )
}

describe('createAppOctokit', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  test('requires env vars', () => {
    vi.stubEnv('GITHUB_APP_ID', '')
    vi.stubEnv('GITHUB_APP_PRIVATE_KEY', '')
    expect(() => createAppOctokit()).toThrow(
      /GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY/,
    )
  })

  test('returns Octokit when env is set', () => {
    vi.stubEnv('GITHUB_APP_ID', '12345')
    vi.stubEnv(
      'GITHUB_APP_PRIVATE_KEY',
      Buffer.from('fake-pem').toString('base64'),
    )
    expect(createAppOctokit()).toBeDefined()
  })
})

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

describe('resolveOctokitForInstallation', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  test('returns Octokit for given installation id', () => {
    stubGithubAppEnv()
    expect(resolveOctokitForInstallation(99)).toBeDefined()
  })
})

describe('resolveOctokitForRepository', () => {
  beforeEach(() => {
    stubGithubAppEnv()
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  const integrationGithubApp = {
    method: 'github_app',
    privateToken: null,
  } as const
  const integrationToken = {
    method: 'token',
    privateToken: 'ghp_test',
  } as const
  const integrationTokenEmpty = {
    method: 'token',
    privateToken: null,
  } as const

  describe('github_app mode with explicit installation id on repository', () => {
    test('uses repository.githubInstallationId when matching link is active', () => {
      const o = resolveOctokitForRepository({
        integration: integrationGithubApp,
        githubAppLinks: [{ installationId: 42, suspendedAt: null }],
        repository: { githubInstallationId: 42 },
      })
      expect(o).toBeDefined()
    })

    test('throws when matching link does not exist', () => {
      expect(() =>
        resolveOctokitForRepository({
          integration: integrationGithubApp,
          githubAppLinks: [{ installationId: 99, suspendedAt: null }],
          repository: { githubInstallationId: 42 },
        }),
      ).toThrow(/installation 42 not found in active links/)
    })

    test('throws when matching link is suspended', () => {
      expect(() =>
        resolveOctokitForRepository({
          integration: integrationGithubApp,
          githubAppLinks: [
            { installationId: 42, suspendedAt: '2026-04-07T00:00:00Z' },
          ],
          repository: { githubInstallationId: 42 },
        }),
      ).toThrow(/installation 42 is suspended/)
    })
  })

  describe('github_app mode strict (no canonical installation)', () => {
    test('throws when github_app repo has githubInstallationId === null', () => {
      expect(() =>
        resolveOctokitForRepository({
          integration: integrationGithubApp,
          githubAppLinks: [{ installationId: 7, suspendedAt: null }],
          repository: { githubInstallationId: null },
        }),
      ).toThrow(/Repository has no canonical installation assigned/)
    })
  })

  describe('token mode', () => {
    test('with privateToken: uses PAT (canonical installation irrelevant)', () => {
      const o = resolveOctokitForRepository({
        integration: integrationToken,
        githubAppLinks: [],
        repository: { githubInstallationId: null },
      })
      expect(o).toBeDefined()
    })

    test('without privateToken: throws', () => {
      expect(() =>
        resolveOctokitForRepository({
          integration: integrationTokenEmpty,
          githubAppLinks: [],
          repository: { githubInstallationId: null },
        }),
      ).toThrow(/No auth configured/)
    })
  })

  test('throws when no integration', () => {
    expect(() =>
      resolveOctokitForRepository({
        integration: null,
        githubAppLinks: [],
        repository: { githubInstallationId: null },
      }),
    ).toThrow(/No integration configured/)
  })
})
