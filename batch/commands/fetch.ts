import { requireOrganizationWithProvider } from './helpers'

interface FetchCommandProps {
  organizationId?: string
  repositoryId?: string
  refresh: boolean
  exclude?: string
}

export async function fetchCommand(props: FetchCommandProps) {
  const result = await requireOrganizationWithProvider(props.organizationId)
  if (!result) return

  const { orgId, organization, provider } = result

  const repositories = organization.repositories.filter((repo) => {
    return props.repositoryId
      ? repo.id === props.repositoryId
      : repo.id !== props.exclude
  })
  for (const repository of repositories) {
    await provider.fetch(orgId, repository, {
      refresh: props.refresh,
      halt: false,
    })
  }
}
