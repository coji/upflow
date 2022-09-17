import invariant from 'tiny-invariant'
import { prisma } from '~/app/db.server'
import { allConfigs } from '../config'
import { createProvider } from '../provider/index'
import { exportToSpreadsheet } from '../export'

interface UpsertCommandProps {
  companyId?: string
}
export async function upsertCommand({ companyId }: UpsertCommandProps) {
  if (!companyId) {
    console.log('config should specified')
    console.log((await allConfigs()).map((c) => `${c.companyName}\t${c.companyId}`).join('\n'))
    return
  }

  const company = await prisma.company.findFirstOrThrow({
    where: { id: companyId },
    include: { integration: true, repositories: true }
  })
  invariant(company.integration, 'integration shoud related')

  const provider = createProvider(company.integration)
  invariant(provider, `unknown provider ${company.integration.provider}`)

  const pullrequests = await provider.upsert(company, company.repositories)

  await exportToSpreadsheet(company, pullrequests) // google spreadsheet にエクスポート
}
