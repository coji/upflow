export interface Repository {
  id: string
  name: string
  visibility: string
  owner: string
  pushedAt: string | null
}

interface PageInfo {
  hasNextPage: boolean
  endCursor: string | null
}

interface getRepositoriesByOwnerAndKeywordProps {
  token: string
  cursor: string | undefined
  owner?: string
  keyword: string
}
export const getRepositoriesByOwnerAndKeyword = async ({
  token,
  cursor,
  owner,
  keyword,
}: getRepositoriesByOwnerAndKeywordProps): Promise<{
  repos: Repository[]
  pageInfo: PageInfo
}> => {
  if (!owner) {
    return {
      repos: [],
      pageInfo: { endCursor: null, hasNextPage: false },
    }
  }

  // REST Search API: GET /search/repositories
  const q = `user:${owner}${keyword ? ` ${keyword} in:name` : ''} sort:updated-desc`
  const page = cursor ? Number.parseInt(cursor, 10) : 1
  const perPage = 10

  const url = new URL('https://api.github.com/search/repositories')
  url.searchParams.set('q', q)
  url.searchParams.set('per_page', String(perPage))
  url.searchParams.set('page', String(page))
  url.searchParams.set('sort', 'updated')

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
  })

  if (!res.ok) {
    return {
      repos: [],
      pageInfo: { endCursor: null, hasNextPage: false },
    }
  }

  const json = await res.json()
  const totalCount: number = json.total_count ?? 0

  const repos: Repository[] = (json.items ?? []).map(
    (item: {
      node_id: string
      name: string
      visibility: string
      owner: { login: string }
      pushed_at: string | null
    }) => ({
      id: item.node_id,
      name: item.name,
      visibility: item.visibility ?? 'private',
      owner: item.owner.login,
      pushedAt: item.pushed_at,
    }),
  )

  const hasNextPage = page * perPage < totalCount

  return {
    repos,
    pageInfo: {
      endCursor: hasNextPage ? String(page + 1) : null,
      hasNextPage,
    },
  }
}
