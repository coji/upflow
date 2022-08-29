import invariant from 'tiny-invariant'
import { allConfigs } from '../config'
import { createProvider } from '../provider'
import { prisma } from '~/app/db.server'

interface FetchCommandProps {
  companyId?: string
  refresh: boolean
}

export async function fetchCommand(props: FetchCommandProps) {
  if (!props.companyId) {
    console.log(`Error: company id should spacify`)
    console.log((await allConfigs()).map((c) => `${c.companyName}\t${c.companyId}`).join('\n'))
    return
  }

  const company = await prisma.company.findFirstOrThrow({ where: { id: props.companyId }, include: { integration: true, repositories: true } })
  invariant(company.integration, 'integration shoud related')
  const provider = createProvider(company.integration.provider)
  invariant(provider, `unkown provider: ${company.integration.provider}`)

  for (const repository of company.repositories) {
    await provider.fetch(company.integration, repository, { refresh: props.refresh, halt: false })
  }
}
