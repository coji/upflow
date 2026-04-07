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
 * pick the first active installation transparently so installations don't
 * need to be exposed in the UI.
 */
export const searchGithubUsers = async (
  organizationId: OrganizationId,
  query: string,
): Promise<{ login: string; avatarUrl: string }[]> => {
  try {
    const integration = await getIntegration(organizationId)
    if (!integration) return []

    let octokit: ReturnType<typeof resolveOctokitForInstallation>
    if (integration.method === 'github_app') {
      const [firstActive] = await getActiveInstallationOptions(organizationId)
      if (!firstActive) return []
      octokit = resolveOctokitForInstallation(firstActive.installationId)
    } else {
      if (!integration.privateToken) return []
      octokit = createOctokit({
        method: 'token',
        privateToken: integration.privateToken,
      })
    }

    const { data } = await octokit.rest.search.users({
      q: `${query} in:login`,
      per_page: 8,
    })
    return data.items.map((u) => ({
      login: u.login,
      avatarUrl: u.avatar_url,
    }))
  } catch {
    return []
  }
}
