import invariant from 'tiny-invariant'
import { fetchRepo } from '~/batch/github/fetch-repo'
import { requireOrganization } from './helpers'

interface FetchCommandProps {
  organizationId?: string
  repositoryId?: string
  refresh: boolean
  exclude?: string
}

export async function fetchCommand(props: FetchCommandProps) {
  const result = await requireOrganization(props.organizationId)
  if (!result) return

  const { orgId, organization } = result
  invariant(organization.integration, 'integration should related')

  const repositories = organization.repositories.filter((repo) => {
    return props.repositoryId
      ? repo.id === props.repositoryId
      : repo.id !== props.exclude
  })
  for (const repository of repositories) {
    await fetchRepo(orgId, repository, organization.integration, {
      refresh: props.refresh,
      halt: false,
    })
  }
}
