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
      pageInfo: {
        endCursor: null,
        hasNextPage: false,
      },
    }
  }

  // 検索クエリ例: "user:owner in:name キーワード"
  const queryString = `user:${owner} in:name ${keyword} sort:updated-desc`
  const query = `
    query ($queryString: String!, $cursor: String) {
      search(query: $queryString, type: REPOSITORY, first: 10, after: $cursor) {
        nodes {
          ... on Repository {
            id
            name
            visibility
            owner { login }
            pushedAt
          }
        }
        pageInfo {
          endCursor
          hasNextPage
        }
      }
    }
  `

  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables: { queryString, cursor } }),
  })
  const json = await res.json()
  const repoData = json.data.search

  const repos: Repository[] = repoData.nodes
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    .map((node: any) => ({
      id: node.id,
      owner: node.owner.login,
      name: node.name,
      visibility: node.visibility,
      pushedAt: node.pushedAt,
    }))

  return {
    repos,
    pageInfo: repoData.pageInfo,
  }
}
