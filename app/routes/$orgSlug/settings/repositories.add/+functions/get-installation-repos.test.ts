import type { Octokit } from 'octokit'
import { describe, expect, test, vi } from 'vitest'
import {
  extractOwners,
  fetchAllInstallationRepos,
  filterInstallationRepos,
  type TaggedInstallationRepo,
} from './get-installation-repos'

describe('get-installation-repos', () => {
  test('fetchAllInstallationRepos calls paginate', async () => {
    const mockRepos = [{ owner: { login: 'acme' } }]
    const octokit = {
      paginate: vi.fn().mockResolvedValue(mockRepos),
      rest: {
        apps: { listReposAccessibleToInstallation: vi.fn() },
      },
    } as unknown as Octokit

    const result = await fetchAllInstallationRepos(octokit)
    expect(result).toEqual(mockRepos)
    expect(octokit.paginate).toHaveBeenCalled()
  })

  test('extractOwners returns sorted unique logins', () => {
    const tagged = [
      { installationId: 1, repo: { owner: { login: 'zebra' } } },
      { installationId: 1, repo: { owner: { login: 'alpha' } } },
      { installationId: 2, repo: { owner: { login: 'alpha' } } },
    ] as unknown as TaggedInstallationRepo[]

    expect(extractOwners(tagged)).toEqual(['alpha', 'zebra'])
  })

  test('filterInstallationRepos filters by owner and keyword and maps fields', () => {
    const tagged = [
      {
        installationId: 100,
        repo: {
          id: 1,
          node_id: 'R_kgDOA',
          name: 'foo-bar',
          full_name: 'acme/foo-bar',
          private: true,
          owner: { login: 'acme' },
          pushed_at: '2024-01-02T00:00:00Z',
        },
      },
      {
        installationId: 100,
        repo: {
          id: 2,
          node_id: 'R_kgDOB',
          name: 'other',
          full_name: 'acme/other',
          private: false,
          owner: { login: 'acme' },
          pushed_at: null,
        },
      },
      {
        installationId: 200,
        repo: {
          id: 3,
          name: 'nope',
          owner: { login: 'other-org' },
          private: true,
          pushed_at: null,
        },
      },
    ] as unknown as TaggedInstallationRepo[]

    const result = filterInstallationRepos(tagged, 'acme', 'bar')
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      id: 'R_kgDOA',
      name: 'foo-bar',
      owner: 'acme',
      visibility: 'private',
      pushedAt: '2024-01-02T00:00:00Z',
      installationId: 100,
    })
  })

  test('filterInstallationRepos falls back to String(id) when node_id is missing', () => {
    const tagged = [
      {
        installationId: 7,
        repo: {
          id: 42,
          name: 'no-node-id',
          full_name: 'acme/no-node-id',
          private: false,
          owner: { login: 'acme' },
          pushed_at: null,
        },
      },
    ] as unknown as TaggedInstallationRepo[]

    const result = filterInstallationRepos(tagged, 'acme')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('42')
    expect(result[0].installationId).toBe(7)
  })

  test('filterInstallationRepos returns [] when owner is missing', () => {
    const tagged = [] as TaggedInstallationRepo[]
    expect(filterInstallationRepos(tagged, undefined, 'x')).toEqual([])
  })
})
