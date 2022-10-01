import { Octokit } from "octokit"

export const listGithubRepos = async (token: string) => {
  const octokit = new Octokit({
    auth: token,
  })

  const repos = await octokit.paginate(
    octokit.rest.repos.listForAuthenticatedUser,
    (res) =>
      res.data.map((repo) => ({
        id: repo.node_id,
        full_name: repo.full_name,
        defaultBranch: repo.default_branch,
        visibility: repo.visibility,
        owner: repo.owner.login,
        name: repo.name,
        createdAt: repo.created_at,
        pushedAt: repo.pushed_at,
      }))
  )

  return repos
}
