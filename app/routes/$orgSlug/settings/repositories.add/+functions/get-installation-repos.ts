import type { Octokit } from 'octokit'
import type { Repository } from './get-repositories-by-owner-and-keyword'

/** Fetch all repos accessible to this installation (single paginated call). */
export async function fetchAllInstallationRepos(octokit: Octokit) {
  return await octokit.paginate(
    octokit.rest.apps.listReposAccessibleToInstallation,
    { per_page: 100 },
  )
}

type InstallationRepo = Awaited<ReturnType<typeof fetchAllInstallationRepos>>[0]

/** Extract unique owners from pre-fetched installation repos. */
export function extractOwners(repos: InstallationRepo[]): string[] {
  return [...new Set(repos.map((r) => r.owner.login))].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' }),
  )
}

/** Filter + map pre-fetched installation repos by owner and keyword. */
export function filterInstallationRepos(
  repos: InstallationRepo[],
  owner?: string,
  keyword?: string,
): Repository[] {
  if (!owner) return []
  const kw = keyword?.trim().toLowerCase() ?? ''
  return repos
    .filter((r) => r.owner.login === owner)
    .filter((r) => !kw || r.name.toLowerCase().includes(kw))
    .map((r) => ({
      id: r.node_id ?? String(r.id),
      name: r.name,
      owner: r.owner.login,
      visibility: r.visibility ?? (r.private ? 'private' : 'public'),
      pushedAt: r.pushed_at ?? null,
    }))
}
