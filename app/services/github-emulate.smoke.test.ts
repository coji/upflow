import { describe, expect, test } from 'vitest'
import { getRepositoriesByOwnerAndKeyword } from '~/app/routes/$orgSlug/settings/repositories.add/+functions/get-repositories-by-owner-and-keyword'
import { getUniqueOwners } from '~/app/routes/$orgSlug/settings/repositories.add/+functions/get-unique-owners'
import { createOctokit } from './github-octokit.server'

const githubApiBaseUrl = process.env.GITHUB_API_BASE_URL
const shouldRun =
  process.env.RUN_GITHUB_EMULATE_TESTS === '1' &&
  !!githubApiBaseUrl &&
  githubApiBaseUrl.includes('localhost')

if (process.env.RUN_GITHUB_EMULATE_TESTS === '1' && !shouldRun) {
  console.warn(
    'Skipping GitHub emulate smoke test: set GITHUB_API_BASE_URL to a localhost emulator URL.',
  )
}

const run = shouldRun ? describe : describe.skip
const token = 'test_token_user1'

run('GitHub emulate smoke test', () => {
  test('reads user repositories through fetch helpers', async () => {
    const owners = await getUniqueOwners(token)

    expect(owners).toContain('octocat')

    const result = await getRepositoriesByOwnerAndKeyword({
      token,
      owner: 'octocat',
      keyword: 'personal',
      cursor: undefined,
    })

    expect(result.repos).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          owner: 'octocat',
          name: 'personal-repo',
        }),
      ]),
    )
  })

  test('reads the current user through Octokit', async () => {
    const octokit = createOctokit({ method: 'token', privateToken: token })

    const { data } = await octokit.rest.users.getAuthenticated()

    expect(data.login).toBe('octocat')
  })
})
