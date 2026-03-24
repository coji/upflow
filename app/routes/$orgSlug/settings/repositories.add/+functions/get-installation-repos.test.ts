import type { Octokit } from 'octokit'
import { describe, expect, test, vi } from 'vitest'
import {
  extractOwners,
  fetchAllInstallationRepos,
  filterInstallationRepos,
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
    const repos = [
      { owner: { login: 'zebra' } },
      { owner: { login: 'alpha' } },
      { owner: { login: 'alpha' } },
    ] as Awaited<ReturnType<typeof fetchAllInstallationRepos>>

    expect(extractOwners(repos)).toEqual(['alpha', 'zebra'])
  })

  test('filterInstallationRepos filters by owner and keyword and maps fields', () => {
    const repos = [
      {
        id: 1,
        node_id: 'R_kgDOA',
        name: 'foo-bar',
        full_name: 'acme/foo-bar',
        private: true,
        owner: { login: 'acme' },
        pushed_at: '2024-01-02T00:00:00Z',
      },
      {
        id: 2,
        node_id: 'R_kgDOB',
        name: 'other',
        full_name: 'acme/other',
        private: false,
        owner: { login: 'acme' },
        pushed_at: null,
      },
      {
        id: 3,
        name: 'nope',
        owner: { login: 'other-org' },
        private: true,
        pushed_at: null,
      },
    ] as Awaited<ReturnType<typeof fetchAllInstallationRepos>>

    const result = filterInstallationRepos(repos, 'acme', 'bar')
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      id: 'R_kgDOA',
      name: 'foo-bar',
      owner: 'acme',
      visibility: 'private',
      pushedAt: '2024-01-02T00:00:00Z',
    })
  })

  test('filterInstallationRepos returns [] when owner is missing', () => {
    const repos = [] as unknown as Awaited<
      ReturnType<typeof fetchAllInstallationRepos>
    >
    expect(filterInstallationRepos(repos, undefined, 'x')).toEqual([])
  })
})
