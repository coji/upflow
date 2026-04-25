import { describe, expect, test } from 'vitest'
import { getRepositoriesByOwnerAndKeyword } from '~/app/routes/$orgSlug/settings/repositories.add/+functions/get-repositories-by-owner-and-keyword'
import { getUniqueOwners } from '~/app/routes/$orgSlug/settings/repositories.add/+functions/get-unique-owners'
import { createOctokit } from './github-octokit.server'

const run =
  process.env.RUN_GITHUB_EMULATE_TESTS === '1' ? describe : describe.skip
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
