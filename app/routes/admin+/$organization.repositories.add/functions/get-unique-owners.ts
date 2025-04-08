// ユニークなオーナー一覧を取得する関数
export async function getUniqueOwners(token: string): Promise<string[]> {
  const [viewerOrganizations, viewableRepositoriesOrganizations] =
    await Promise.all([
      getViewerOrganizations(token),
      getViewableRepositoriesOrganizations(token),
    ])

  return Array.from(
    new Set([...viewerOrganizations, ...viewableRepositoriesOrganizations]),
  )
}

const getViewerOrganizations = async (token: string) => {
  const owners = new Set<string>()
  let cursor: string | undefined = undefined
  let hasNextPage = true

  const query = `
    query ($cursor: String) {
      viewer {
        organizations(first: 100, after: $cursor) {
          nodes {
            login
          }
          pageInfo { endCursor hasNextPage }
        }
      }
    }
  `

  while (hasNextPage) {
    const res: Response = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables: { cursor } }),
    })
    const json = await res.json()
    const organizations = json.data.viewer.organizations
    for (const node of organizations.nodes) {
      owners.add(node.login)
    }
    hasNextPage = organizations.pageInfo.hasNextPage
    cursor = organizations.pageInfo.endCursor
  }

  return Array.from(owners)
}

/**
 *  参照可能なリポジトリのオーナー一覧を取得する
 */
const getViewableRepositoriesOrganizations = async (
  token: string,
): Promise<string[]> => {
  const owners = new Set<string>()
  let cursor: string | undefined = undefined
  let hasNextPage = true

  const query = `
    query ($cursor: String) {
      viewer {
        repositories(first: 100, after: $cursor, affiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER]) {
          nodes {
            owner { login }
          }
          pageInfo { endCursor hasNextPage }
        }
      }
    }
  `

  while (hasNextPage) {
    const res: Response = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables: { cursor } }),
    })
    const json = await res.json()
    const repoData = json.data.viewer.repositories
    for (const node of repoData.nodes) {
      owners.add(node.owner.login)
    }
    hasNextPage = repoData.pageInfo.hasNextPage
    cursor = repoData.pageInfo.endCursor
  }

  return Array.from(owners)
}
