// ユニークなオーナー一覧を取得する関数
export async function getUniqueOwners(token: string): Promise<string[]> {
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
