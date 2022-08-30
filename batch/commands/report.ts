import invariant from 'tiny-invariant'
import { allConfigs } from '../config'
import { prisma } from '~/app/db.server'
import { createProvider } from '../provider'

interface reportCommandProps {
  companyId?: string
}

export async function reportCommand({ companyId }: reportCommandProps) {
  if (!companyId) {
    console.log('config should specified')
    console.log((await allConfigs()).map((c) => `${c.companyName}\t${c.companyId}`).join('\n'))
    return
  }

  const company = await prisma.company.findFirstOrThrow({ where: { id: companyId }, include: { integration: true, repositories: true } })
  invariant(company.integration, 'integration shoud related')

  const provider = createProvider(company.integration.provider)
  invariant(provider, `unknown provider ${company.integration.provider}`)
  await provider.report(company.repositories)
}
