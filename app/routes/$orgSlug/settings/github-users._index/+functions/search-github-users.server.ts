import {
  getGithubAppLink,
  getIntegration,
} from '~/app/services/github-integration-queries.server'
import { resolveOctokitFromOrg } from '~/app/services/github-octokit.server'
import type { OrganizationId } from '~/app/types/organization'

export const searchGithubUsers = async (
  organizationId: OrganizationId,
  query: string,
): Promise<{ login: string; avatarUrl: string }[]> => {
  try {
    const [integration, githubAppLink] = await Promise.all([
      getIntegration(organizationId),
      getGithubAppLink(organizationId),
    ])
    const octokit = resolveOctokitFromOrg({ integration, githubAppLink })
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
