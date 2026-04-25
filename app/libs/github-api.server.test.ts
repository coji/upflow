import { afterEach, describe, expect, test, vi } from 'vitest'
import { getGithubApiBaseUrl, githubApiUrl } from './github-api.server'

describe('GitHub API URL helpers', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  test('uses api.github.com by default', () => {
    vi.stubEnv('GITHUB_API_BASE_URL', '')

    expect(getGithubApiBaseUrl()).toBe('https://api.github.com')
    expect(githubApiUrl('/user')).toBe('https://api.github.com/user')
  })

  test('uses GITHUB_API_BASE_URL without trailing slashes', () => {
    vi.stubEnv('GITHUB_API_BASE_URL', 'http://localhost:4001///')

    expect(getGithubApiBaseUrl()).toBe('http://localhost:4001')
    expect(githubApiUrl('search/repositories')).toBe(
      'http://localhost:4001/search/repositories',
    )
  })
})
