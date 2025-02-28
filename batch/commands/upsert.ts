import consola from 'consola'
import invariant from 'tiny-invariant'
import { getCompany, upsertPullRequest } from '~/batch/db'
import {
  exportPullsToSpreadsheet,
  exportReviewResponsesToSpreadsheet,
} from '../bizlogic/export-spreadsheet'
import { allConfigs } from '../config'
import { createProvider } from '../provider/index'

interface UpsertCommandProps {
  companyId?: string
}
export async function upsertCommand({ companyId }: UpsertCommandProps) {
  if (!companyId) {
    consola.error('config should specified')
    consola.info(
      (await allConfigs())
        .map((c) => `${c.companyName}\t${c.companyId}`)
        .join('\n'),
    )
    return
  }

  const company = await getCompany(companyId)
  invariant(company.integration, 'integration should related')

  const provider = createProvider(company.integration)
  invariant(provider, `unknown provider ${company.integration.provider}`)

  const { pulls, reviewResponses } = await provider.analyze(
    company,
    company.repositories,
  )

  // upsert
  for (const pr of pulls) {
    await upsertPullRequest(pr)
  }

  if (company.exportSetting) {
    await exportPullsToSpreadsheet(pulls, company.exportSetting) // google spreadsheet にエクスポート
    await exportReviewResponsesToSpreadsheet(
      reviewResponses,
      company.exportSetting,
    )
  }
}
