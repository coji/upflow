import consola from 'consola'
import invariant from 'tiny-invariant'
import { getOrganization } from '~/batch/db'
import { allConfigs } from '../config'
import { createProvider } from '../provider'

interface FetchCommandProps {
  organizationId?: string
  repositoryId?: string
  refresh: boolean
  delay?: number
  exclude?: string
}

export async function fetchCommand(props: FetchCommandProps) {
  if (!props.organizationId) {
    consola.error('Error: organization id should specify')
    consola.info(
      (await allConfigs())
        .map((o) => `${o.organizationName}\t${o.organizationId}`)
        .join('\n'),
    )
    return
  }

  const organization = await getOrganization(props.organizationId)
  invariant(organization.integration, 'integration should related')

  const provider = createProvider(organization.integration)
  invariant(provider, `unknown provider: ${organization.integration.provider}`)

  const repositories = organization.repositories.filter((repo) => {
    return props.repositoryId
      ? repo.id === props.repositoryId
      : repo.id !== props.exclude
  })
  for (const repository of repositories) {
    await provider.fetch(repository, {
      refresh: props.refresh,
      halt: false,
      delay: props.delay,
    })
  }
}
