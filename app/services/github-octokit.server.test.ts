import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  assertOrgGithubAuthResolvable,
  createAppOctokit,
  createOctokit,
  resolveOctokitForInstallation,
  resolveOctokitForRepository,
  resolveOctokitFromOrg,
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
    stubGithubAppEnv()
    const o = resolveOctokitFromOrg({
      integration: { method: 'github_app', privateToken: null },
      githubAppLink: { installationId: 42 },
    })
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
      ).toThrow(/installation 42 is not active/)
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

  describe('github_app mode transitional fallback (githubInstallationId IS NULL)', () => {
    test('active link 1 件: uses that installation', () => {
      const o = resolveOctokitForRepository({
        integration: integrationGithubApp,
        githubAppLinks: [{ installationId: 7, suspendedAt: null }],
        repository: { githubInstallationId: null },
      })
      expect(o).toBeDefined()
    })

    test('active link 0 件: throws (does NOT fall back to PAT)', () => {
      expect(() =>
        resolveOctokitForRepository({
          integration: integrationGithubApp,
          githubAppLinks: [],
          repository: { githubInstallationId: null },
        }),
      ).toThrow(/GitHub App is not connected/)
    })

    test('active link 2 件以上: throws backfill required', () => {
      expect(() =>
        resolveOctokitForRepository({
          integration: integrationGithubApp,
          githubAppLinks: [
            { installationId: 1, suspendedAt: null },
            { installationId: 2, suspendedAt: null },
          ],
          repository: { githubInstallationId: null },
        }),
      ).toThrow(/Backfill required/)
    })

    test('suspended links are excluded from active count (1 active + 1 suspended → uses active)', () => {
      const o = resolveOctokitForRepository({
        integration: integrationGithubApp,
        githubAppLinks: [
          { installationId: 1, suspendedAt: null },
          { installationId: 2, suspendedAt: '2026-04-07T00:00:00Z' },
        ],
        repository: { githubInstallationId: null },
      })
      expect(o).toBeDefined()
    })
  })

  describe('token mode', () => {
    test('with privateToken: uses PAT', () => {
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
