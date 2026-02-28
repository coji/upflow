import {
  type OrganizationId,
  getTenantDb,
} from '~/app/services/tenant-db.server'

interface GitHubSearchUser {
  login: string
  avatar_url: string
}

interface GitHubSearchResponse {
  items: GitHubSearchUser[]
}

export const searchGithubUsers = async (
  organizationId: OrganizationId,
  query: string,
): Promise<{ login: string; avatarUrl: string }[]> => {
  const tenantDb = getTenantDb(organizationId)
  const integration = await tenantDb
    .selectFrom('integrations')
    .select('privateToken')
    .executeTakeFirst()

  if (!integration?.privateToken) return []

  const url = new URL('https://api.github.com/search/users')
  url.searchParams.set('q', `${query} in:login`)
  url.searchParams.set('per_page', '8')

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${integration.privateToken}`,
    },
  })

  if (!response.ok) return []

  const data: GitHubSearchResponse = await response.json()
  return data.items.map((item) => ({
    login: item.login,
    avatarUrl: item.avatar_url,
  }))
}
