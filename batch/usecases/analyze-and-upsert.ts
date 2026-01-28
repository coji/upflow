import type { DB, Selectable } from '~/app/services/db.server'
import {
  exportPullsToSpreadsheet,
  exportReviewResponsesToSpreadsheet,
} from '~/batch/bizlogic/export-spreadsheet'
import { upsertPullRequest } from '~/batch/db'
import { logger } from '~/batch/helper/logger'
import type { createProvider } from '~/batch/provider'

/** Provider 型（null を除外） */
type Provider = NonNullable<ReturnType<typeof createProvider>>

/** analyzeAndUpsert に渡す organization の必須フィールド */
interface OrganizationForAnalyze {
  id: string
  organizationSetting: Pick<
    Selectable<DB.OrganizationSettings>,
    'releaseDetectionMethod' | 'releaseDetectionKey' | 'excludedUsers'
  >
  repositories: Selectable<DB.Repositories>[]
  exportSetting?: Selectable<DB.ExportSettings> | null
}

interface AnalyzeAndUpsertParams {
  organization: OrganizationForAnalyze
  provider: Provider
}

/**
 * PR 解析 → DB upsert → スプレッドシート export を行うユースケース
 */
export async function analyzeAndUpsert({
  organization,
  provider,
}: AnalyzeAndUpsertParams) {
  const orgId = organization.id

  // 1. analyze
  logger.info('analyze started...', orgId)
  const { pulls, reviewResponses } = await provider.analyze(
    organization.organizationSetting,
    organization.repositories,
  )
  logger.info('analyze completed.', orgId)

  // 2. upsert
  logger.info('upsert started...', orgId)
  for (const pr of pulls) {
    await upsertPullRequest(pr)
  }
  logger.info('upsert completed.', orgId)

  // 3. export (optional)
  if (organization.exportSetting) {
    logger.info('exporting to spreadsheet...', orgId)
    await exportPullsToSpreadsheet(pulls, organization.exportSetting)
    await exportReviewResponsesToSpreadsheet(
      reviewResponses,
      organization.exportSetting,
    )
    logger.info('export to spreadsheet done.', orgId)
  }

  return { pulls, reviewResponses }
}
