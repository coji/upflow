import {
  getActiveInstallationOptions,
  getIntegration,
} from '~/app/services/github-integration-queries.server'
import {
  createOctokit,
  resolveOctokitForInstallation,
} from '~/app/services/github-octokit.server'
import type { OrganizationId } from '~/app/types/organization'

/**
 * Search GitHub users via the search API.
 *
 * `search.users` is a global GitHub endpoint — the choice of authentication
 * doesn't change the result set, only rate limits. For `github_app` orgs we
 * iterate active installations in order and fall through to the next one
 * on transient failures (rate limit, revoked installation, etc.), so a
 * single troubled installation doesn't break the search UX for the whole
 * organization.
 */
export const searchGithubUsers = async (
  organizationId: OrganizationId,
  query: string,
): Promise<{ login: string; avatarUrl: string }[]> => {
  const integration = await getIntegration(organizationId)
  if (!integration) return []

  const runSearch = async (octokit: ReturnType<typeof createOctokit>) => {
    const { data } = await octokit.rest.search.users({
      q: `${query} in:login`,
      per_page: 8,
    })
    return data.items.map((u) => ({
      login: u.login,
      avatarUrl: u.avatar_url,
    }))
  }

  if (integration.method === 'github_app') {
    const installations = await getActiveInstallationOptions(organizationId)
    for (const installation of installations) {
      try {
        const octokit = resolveOctokitForInstallation(
          installation.installationId,
        )
        return await runSearch(octokit)
      } catch (e) {
        console.warn(
          `[searchGithubUsers] installation ${installation.installationId} failed, trying next`,
          e,
        )
      }
    }
    return []
  }

  if (!integration.privateToken) return []
  try {
    const octokit = createOctokit({
      method: 'token',
      privateToken: integration.privateToken,
    })
    return await runSearch(octokit)
  } catch {
    return []
  }
}
