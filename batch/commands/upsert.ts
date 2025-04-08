import consola from 'consola'
import invariant from 'tiny-invariant'
import { getOrganization, upsertPullRequest } from '~/batch/db'
import {
  exportPullsToSpreadsheet,
  exportReviewResponsesToSpreadsheet,
} from '../bizlogic/export-spreadsheet'
import { allConfigs } from '../config'
import { createProvider } from '../provider/index'

interface UpsertCommandProps {
  organizationId?: string
}
export async function upsertCommand({ organizationId }: UpsertCommandProps) {
  if (!organizationId) {
    consola.error('config should specified')
    consola.info(
      (await allConfigs())
        .map((o) => `${o.organizationName}\t${o.organizationId}`)
        .join('\n'),
    )
    return
  }

  const organization = await getOrganization(organizationId)
  invariant(organization.integration, 'integration should related')

  const provider = createProvider(organization.integration)
  invariant(provider, `unknown provider ${organization.integration.provider}`)
  invariant(
    organization.organizationSetting,
    'organization setting should related',
  )

  const { pulls, reviewResponses } = await provider.analyze(
    organization.organizationSetting,
    organization.repositories,
  )

  // upsert
  for (const pr of pulls) {
    await upsertPullRequest(pr)
  }

  if (organization.exportSetting) {
    await exportPullsToSpreadsheet(pulls, organization.exportSetting) // google spreadsheet にエクスポート
    await exportReviewResponsesToSpreadsheet(
      reviewResponses,
      organization.exportSetting,
    )
  }
}
