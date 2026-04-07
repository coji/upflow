import { resolveOctokitForInstallation } from '~/app/services/github-octokit.server'

export type InstallationRepoCoord = { owner: string; name: string }

/**
 * Fetch every repository visible to a GitHub App installation, paginating
 * through `GET /installation/repositories`. Returns owner/name coordinates only.
 */
export async function fetchInstallationRepositories(
  installationId: number,
): Promise<InstallationRepoCoord[]> {
  const octokit = resolveOctokitForInstallation(installationId)

  const repos: InstallationRepoCoord[] = []
  for await (const response of octokit.paginate.iterator(
    octokit.rest.apps.listReposAccessibleToInstallation,
    { per_page: 100 },
  )) {
    for (const repo of response.data) {
      if (typeof repo.name !== 'string') continue
      const ownerLogin = repo.owner?.login
      if (typeof ownerLogin !== 'string') continue
      repos.push({ owner: ownerLogin, name: repo.name })
    }
  }
  return repos
}
