import invariant from 'tiny-invariant'
import { prisma } from '~/app/utils/db.server'
import { allConfigs } from '../config'
import { createProvider } from '../provider/index'
import { exportPullsToSpreadsheet, exportReviewResponsesToSpreadsheet } from '../bizlogic/export-spreadsheet'

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
    include: { integration: true, repositories: true, exportSetting: true },
  })
  invariant(company.integration, 'integration shoud related')

  const provider = createProvider(company.integration)
  invariant(provider, `unknown provider ${company.integration.provider}`)

  const { pulls, reviewResponses } = await provider.analyze(company, company.repositories)

  // upsert
  await prisma.$transaction(
    pulls.map((pr) =>
      prisma.pullRequest.upsert({
        where: {
          repositoryId_number: {
            repositoryId: pr.repositoryId,
            number: pr.number,
          },
        },
        create: pr,
        update: pr,
      }),
    ),
  )

  if (company.exportSetting) {
    await exportPullsToSpreadsheet(pulls, company.exportSetting) // google spreadsheet にエクスポート
    await exportReviewResponsesToSpreadsheet(reviewResponses, company.exportSetting)
  }
}
