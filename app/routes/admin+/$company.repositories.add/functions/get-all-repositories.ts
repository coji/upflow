import { unique } from 'remeda'

interface Repository {
  id: string
  name: string
  visibility: 'PUBLIC' | 'PRIVATE'
  owner: string
  lastCommitDate: string | null
}

interface PageInfo {
  endCursor: string | null
  hasNextPage: boolean
}

async function fetchRepositories(
  token: string,
  cursor?: string,
): Promise<{ repos: Repository[]; pageInfo: PageInfo }> {
  const query = `
    query ($cursor: String) {
      viewer {
        repositories(first: 100, after: $cursor, affiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER]) {
          nodes {
            id
            name
            visibility
            owner {
              login
            }
            defaultBranchRef {
              target {
                ... on Commit {
                  committedDate
                }
              }
            }
          }
          pageInfo {
            endCursor
            hasNextPage
          }
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
    body: JSON.stringify({ query, variables: { cursor } }),
  })
  const json = await res.json()
  const repoData = json.data.viewer.repositories

  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  const repos: Repository[] = repoData.nodes.map((node: any) => ({
    id: node.id,
    name: node.name,
    visibility: node.visibility,
    owner: node.owner.login,
    lastCommitDate: node.defaultBranchRef?.target?.committedDate || null,
  }))

  return {
    repos,
    pageInfo: repoData.pageInfo,
  }
}

export async function getAllRepositories(token: string): Promise<{
  owners: string[]
  repos: Repository[]
}> {
  let allRepos: Repository[] = []
  let cursor: string | undefined = undefined
  let hasNextPage = true

  while (hasNextPage) {
    const { repos, pageInfo } = await fetchRepositories(token, cursor)
    allRepos = allRepos.concat(repos)
    cursor = pageInfo.endCursor ?? undefined
    hasNextPage = pageInfo.hasNextPage
  }

  const owners = unique(allRepos.map((repo) => repo.owner))

  return { owners, repos: allRepos }
}
