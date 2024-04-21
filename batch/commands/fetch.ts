import invariant from 'tiny-invariant'
import { getCompany } from '~/batch/db'
import { allConfigs } from '../config'
import { createProvider } from '../provider'

interface FetchCommandProps {
  companyId?: string
  repositoryId?: string
  refresh: boolean
  delay?: number
  exclude?: string
}

export async function fetchCommand(props: FetchCommandProps) {
  if (!props.companyId) {
    console.log('Error: company id should specify')
    console.log(
      (await allConfigs())
        .map((c) => `${c.companyName}\t${c.companyId}`)
        .join('\n'),
    )
    return
  }

  const company = await getCompany(props.companyId)
  invariant(company.integration, 'integration should related')

  const provider = createProvider(company.integration)
  invariant(provider, `unknown provider: ${company.integration.provider}`)

  const repositories = company.repositories.filter((repo) => {
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
