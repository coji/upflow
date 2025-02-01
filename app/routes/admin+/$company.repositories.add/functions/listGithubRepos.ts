import { Octokit } from 'octokit'
import type { GithubRepo } from '~/app/features/admin/setup/interfaces/model'
import { parseLinkHeader } from '~/app/libs/parse-link-header'

interface listGithubReposProps {
  token: string
  page?: number
  perPage?: number
  query?: string
}
export const listGithubRepos = async ({
  token,
  page = 1,
  perPage = 10,
  query,
}: listGithubReposProps) => {
  const octokit = new Octokit({
    auth: token,
  })

  const repos = await octokit.rest.repos.listForAuthenticatedUser({
    page,
    per_page: perPage,
    query,
    sort: 'pushed',
  })

  const link = parseLinkHeader(repos.headers.link)

  return {
    link: {
      first: link?.first?.page,
      prev: link?.prev?.page,
      next: link?.next?.page,
      last: link?.last?.page,
    },
    data: repos.data.map(
      (repo) =>
        ({
          id: repo.node_id,
          full_name: repo.full_name,
          defaultBranch: repo.default_branch,
          visibility: repo.visibility,
          owner: repo.owner.login,
          name: repo.name,
          createdAt: repo.created_at,
          pushedAt: repo.pushed_at,
        }) satisfies GithubRepo,
    ),
  }
}
