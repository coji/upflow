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

export type TaggedInstallationRepo = {
  installationId: number
  repo: InstallationRepo
}

/** Extract unique owners from pre-fetched installation repos. */
export function extractOwners(tagged: TaggedInstallationRepo[]): string[] {
  return [...new Set(tagged.map((t) => t.repo.owner.login))].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' }),
  )
}

/** Filter + map pre-fetched installation repos by owner and keyword. */
export function filterInstallationRepos(
  tagged: TaggedInstallationRepo[],
  owner?: string,
  keyword?: string,
): Repository[] {
  if (!owner) return []
  const kw = keyword?.trim().toLowerCase() ?? ''
  return tagged
    .filter((t) => t.repo.owner.login === owner)
    .filter((t) => !kw || t.repo.name.toLowerCase().includes(kw))
    .map(({ installationId, repo }) => ({
      id: repo.node_id ?? String(repo.id),
      name: repo.name,
      owner: repo.owner.login,
      visibility: repo.visibility ?? (repo.private ? 'private' : 'public'),
      pushedAt: repo.pushed_at ?? null,
      installationId,
    }))
}
