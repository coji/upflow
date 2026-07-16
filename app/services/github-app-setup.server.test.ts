import { beforeEach, describe, expect, test, vi } from 'vitest'
import { clearOrgCache } from '~/app/services/cache.server'
import {
  logGithubAppLinkEvent,
  tryLogGithubAppLinkEvent,
} from '~/app/services/github-app-link-events.server'
import {
  initializeMembershipsForInstallation,
  reassignCanonicalAfterLinkLoss,
  reconcileMembershipSnapshot,
} from '~/app/services/github-app-membership.server'
import { fetchInstallationRepositories } from '~/app/services/github-installation-repos.server'
import {
  createAppOctokit,
  resolveOctokitForInstallation,
} from '~/app/services/github-octokit.server'
import {
  completeGithubAppSetup,
  GithubInstallationAlreadyLinkedError,
  verifyGithubInstallation,
  verifyUserCanManageGithubInstallation,
} from './github-app-setup.server'

const dbMocks = vi.hoisted(() => ({ executeTakeFirst: vi.fn() }))

vi.mock('~/app/services/cache.server', () => ({ clearOrgCache: vi.fn() }))
vi.mock('~/app/services/github-app-link-events.server', () => ({
  logGithubAppLinkEvent: vi.fn(),
  tryLogGithubAppLinkEvent: vi.fn(),
}))
vi.mock('~/app/services/github-app-membership.server', () => ({
  initializeMembershipsForInstallation: vi.fn(),
  reassignCanonicalAfterLinkLoss: vi.fn(),
  reconcileMembershipSnapshot: vi.fn(),
}))
vi.mock('~/app/services/github-installation-repos.server', () => ({
  fetchInstallationRepositories: vi.fn(),
}))
vi.mock('~/app/services/github-octokit.server', () => ({
  createAppOctokit: vi.fn(),
  resolveOctokitForInstallation: vi.fn(),
}))
vi.mock('~/app/services/db.server', () => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  for (const method of [
    'select',
    'where',
    'values',
    'onConflict',
    'set',
    'execute',
  ]) {
    chain[method] = vi.fn(() => chain)
  }
  chain.executeTakeFirst = dbMocks.executeTakeFirst
  const trx = {
    selectFrom: vi.fn(() => chain),
    insertInto: vi.fn(() => chain),
    updateTable: vi.fn(() => chain),
    deleteFrom: vi.fn(() => chain),
  }
  return {
    db: {
      transaction: vi.fn(() => ({
        execute: vi.fn(
          async (callback: (transaction: typeof trx) => Promise<unknown>) =>
            await callback(trx),
        ),
      })),
      updateTable: vi.fn(() => chain),
      selectFrom: vi.fn(() => chain),
    },
  }
})

const mockCreateAppOctokit = vi.mocked(createAppOctokit)
const mockResolveInstallationOctokit = vi.mocked(resolveOctokitForInstallation)
const mockFetchRepositories = vi.mocked(fetchInstallationRepositories)
const mockInitializeMemberships = vi.mocked(
  initializeMembershipsForInstallation,
)
const mockReconcileMemberships = vi.mocked(reconcileMembershipSnapshot)
const mockReassignCanonical = vi.mocked(reassignCanonicalAfterLinkLoss)
const mockLogEvent = vi.mocked(logGithubAppLinkEvent)
const mockTryLogEvent = vi.mocked(tryLogGithubAppLinkEvent)
const mockClearOrgCache = vi.mocked(clearOrgCache)

const installation = {
  id: 7,
  account: { id: 100, login: 'acme', type: 'Organization' },
  repositorySelection: 'all' as const,
  suspendedAt: null,
}

describe('github-app-setup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dbMocks.executeTakeFirst.mockReset()
    dbMocks.executeTakeFirst.mockResolvedValue(undefined)
    mockFetchRepositories.mockResolvedValue([{ owner: 'acme', name: 'repo' }])
    mockInitializeMemberships.mockResolvedValue(['repo-1'])
  })

  test('verifies and normalizes an installation through the app API', async () => {
    mockCreateAppOctokit.mockReturnValue({
      rest: {
        apps: {
          getInstallation: vi.fn().mockResolvedValue({
            data: {
              id: 7,
              account: { id: 100, login: 'acme', type: 'Organization' },
              repository_selection: 'selected',
              created_at: '2026-07-16T00:00:00Z',
              suspended_at: '2026-07-16T01:00:00Z',
            },
          }),
        },
      },
    } as never)

    await expect(verifyGithubInstallation(7)).resolves.toEqual({
      ...installation,
      repositorySelection: 'selected',
      suspendedAt: '2026-07-16T01:00:00Z',
    })
  })

  test('rejects an installation already owned by another Upflow organization', async () => {
    dbMocks.executeTakeFirst.mockResolvedValue({
      organizationId: 'other-org',
      deletedAt: null,
    })

    await expect(
      completeGithubAppSetup({
        organizationId: 'org-1' as never,
        installation,
      }),
    ).rejects.toThrow(GithubInstallationAlreadyLinkedError)
    expect(mockFetchRepositories).not.toHaveBeenCalled()
  })

  test('records an update and refreshes memberships for an active link', async () => {
    dbMocks.executeTakeFirst.mockResolvedValue({
      organizationId: 'org-1',
      deletedAt: null,
      numUpdatedRows: 1n,
    })
    await completeGithubAppSetup({
      organizationId: 'org-1' as never,
      installation,
      source: 'installation_update_callback',
    })

    expect(mockLogEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'link_updated',
        source: 'installation_update_callback',
      }),
      expect.anything(),
    )
    expect(mockInitializeMemberships).toHaveBeenCalledWith({
      organizationId: 'org-1',
      installationId: 7,
      repositories: [{ owner: 'acme', name: 'repo' }],
      snapshotStartedAt: expect.any(String),
    })
    expect(mockReconcileMemberships).toHaveBeenCalledWith({
      organizationId: 'org-1',
      installationId: 7,
      repositories: [{ owner: 'acme', name: 'repo' }],
      snapshotStartedAt: expect.any(String),
      source: 'installation_update_callback',
    })
    expect(mockTryLogEvent).toHaveBeenCalled()
    expect(mockClearOrgCache).toHaveBeenCalledWith('org-1')
  })

  test('does not resurrect a link disconnected before an update callback commits', async () => {
    dbMocks.executeTakeFirst.mockResolvedValue({
      organizationId: 'org-1',
      deletedAt: '2026-07-16T00:00:00.000Z',
    })

    await expect(
      completeGithubAppSetup({
        organizationId: 'org-1' as never,
        installation,
        source: 'installation_update_callback',
      }),
    ).rejects.toThrow(GithubInstallationAlreadyLinkedError)
    expect(mockFetchRepositories).not.toHaveBeenCalled()
  })

  test('repairs canonical assignments when disconnect races membership refresh', async () => {
    dbMocks.executeTakeFirst
      .mockResolvedValueOnce({
        organizationId: 'org-1',
        deletedAt: null,
      })
      .mockResolvedValueOnce({ numUpdatedRows: 1n })
      .mockResolvedValueOnce({ installationId: 7 })
      .mockResolvedValueOnce({ numUpdatedRows: 0n })

    await completeGithubAppSetup({
      organizationId: 'org-1' as never,
      installation,
      source: 'installation_update_callback',
    })

    expect(mockReassignCanonical).toHaveBeenCalledWith({
      organizationId: 'org-1',
      lostInstallationId: 7,
      source: 'installation_update_callback',
    })
    expect(mockTryLogEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'membership_initialized',
        status: 'failed',
      }),
    )
  })

  test('verifies an active organization owner through GitHub membership API', async () => {
    dbMocks.executeTakeFirst.mockResolvedValue({
      accountId: '123',
    })
    const getById = vi.fn().mockResolvedValue({ data: { login: 'octocat' } })
    const getMembershipForUser = vi.fn().mockResolvedValue({
      data: { role: 'admin', state: 'active' },
    })
    mockResolveInstallationOctokit.mockReturnValue({
      rest: {
        users: { getById },
        orgs: { getMembershipForUser },
      },
    } as never)

    await expect(
      verifyUserCanManageGithubInstallation('user-1', installation),
    ).resolves.toBeUndefined()

    expect(getById).toHaveBeenCalledWith({ account_id: 123 })
    expect(getMembershipForUser).toHaveBeenCalledWith({
      org: 'acme',
      username: 'octocat',
    })
  })

  test('rejects a GitHub user who does not own the installation account', async () => {
    dbMocks.executeTakeFirst.mockResolvedValue({
      accountId: '999',
    })

    await expect(
      verifyUserCanManageGithubInstallation('user-1', {
        ...installation,
        account: { id: 100, login: 'person', type: 'User' },
      }),
    ).rejects.toThrow('does not own')
  })

  test('rejects a suspended installation before querying GitHub membership', async () => {
    await expect(
      verifyUserCanManageGithubInstallation('user-1', {
        ...installation,
        suspendedAt: '2026-07-16T01:00:00Z',
      }),
    ).rejects.toThrow('suspended')

    expect(mockResolveInstallationOctokit).not.toHaveBeenCalled()
  })

  test('preserves transient GitHub failures instead of reporting denied access', async () => {
    dbMocks.executeTakeFirst.mockResolvedValue({ accountId: '123' })
    const transientError = Object.assign(new Error('GitHub unavailable'), {
      status: 503,
    })
    mockResolveInstallationOctokit.mockReturnValue({
      rest: {
        users: { getById: vi.fn().mockRejectedValue(transientError) },
        orgs: { getMembershipForUser: vi.fn() },
      },
    } as never)

    await expect(
      verifyUserCanManageGithubInstallation('user-1', installation),
    ).rejects.toBe(transientError)
  })
})
