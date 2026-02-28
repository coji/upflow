/**
 * REST API GET /user/repos でアクセス可能なリポジトリの
 * ユニークなオーナー一覧を取得する。
 * Fine-grained PAT では GraphQL viewer.repositories や
 * viewer.organizations が制限されるが、REST API なら取得できる。
 */
export async function getUniqueOwners(token: string): Promise<string[]> {
  const owners = new Set<string>()
  let page = 1

  while (true) {
    const res = await fetch(
      `https://api.github.com/user/repos?per_page=100&page=${page}&affiliation=owner,collaborator,organization_member`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
        },
      },
    )
    if (!res.ok) break
    const repos: { owner: { login: string } }[] = await res.json()
    if (repos.length === 0) break
    for (const repo of repos) {
      owners.add(repo.owner.login)
    }
    if (repos.length < 100) break
    page++
  }

  return Array.from(owners).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' }),
  )
}
