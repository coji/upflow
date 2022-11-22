import invariant from 'tiny-invariant'
import { prisma } from '~/app/utils/db.server'
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
    console.log(`Error: company id should specify`)
    console.log((await allConfigs()).map((c) => `${c.companyName}\t${c.companyId}`).join('\n'))
    return
  }

  const company = await prisma.company.findFirstOrThrow({
    where: { id: props.companyId },
    include: { integration: true, repositories: true },
  })
  invariant(company.integration, 'integration should related')

  const provider = createProvider(company.integration)
  invariant(provider, `unknown provider: ${company.integration.provider}`)

  if (props.repositoryId) {
    const repository = company.repositories.find(
      (repository) => repository.id === props.repositoryId && repository.id !== props.exclude,
    )
    if (repository) await provider.fetch(repository, { refresh: props.refresh, halt: false, delay: props.delay })
    else console.log('no such repository:', props.repositoryId)
  } else {
    for (const repository of company.repositories.filter((repository) => repository.id !== props.exclude)) {
      await provider.fetch(repository, { refresh: props.refresh, halt: false, delay: props.delay })
    }
  }
}
