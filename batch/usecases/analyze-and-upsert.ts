import type { Selectable } from 'kysely'
import type { OrganizationId, TenantDB } from '~/app/services/tenant-db.server'
import { createSpreadsheetExporter } from '~/batch/bizlogic/export-spreadsheet'
import {
  upsertCompanyGithubUsers,
  upsertPullRequest,
  upsertPullRequestReview,
  upsertPullRequestReviewers,
} from '~/batch/db'
import { logger } from '~/batch/helper/logger'
import type { Provider } from '~/batch/provider'

/** analyzeAndUpsert に渡す organization の必須フィールド */
interface OrganizationForAnalyze {
  id: OrganizationId
  organizationSetting: Pick<
    Selectable<TenantDB.OrganizationSettings>,
    'releaseDetectionMethod' | 'releaseDetectionKey' | 'excludedUsers'
  >
  repositories: Selectable<TenantDB.Repositories>[]
  exportSetting?: Selectable<TenantDB.ExportSettings> | null
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
  const { pulls, reviews, reviewers, reviewResponses } = await provider.analyze(
    orgId,
    organization.organizationSetting,
    organization.repositories,
  )
  logger.info('analyze completed.', orgId)

  // 2. auto-register discovered GitHub users (inactive)
  const discoveredLogins = new Set<string>()
  for (const pr of pulls) {
    if (pr.author) discoveredLogins.add(pr.author)
  }
  for (const review of reviews) {
    if (review.reviewer) discoveredLogins.add(review.reviewer)
  }
  for (const reviewer of reviewers) {
    for (const login of reviewer.reviewerLogins) {
      discoveredLogins.add(login)
    }
  }
  await upsertCompanyGithubUsers(orgId, [...discoveredLogins])
  logger.info('auto-register github users completed.', orgId)

  // 3. upsert pull requests
  logger.info('upsert started...', orgId)
  for (const pr of pulls) {
    await upsertPullRequest(orgId, pr)
  }
  logger.info('upsert pull requests completed.', orgId)

  // 4. upsert reviews
  logger.info('upsert reviews started...', orgId)
  for (const review of reviews) {
    await upsertPullRequestReview(orgId, review)
  }
  logger.info('upsert reviews completed.', orgId)

  // 5. upsert reviewers
  logger.info('upsert reviewers started...', orgId)
  for (const reviewer of reviewers) {
    await upsertPullRequestReviewers(
      orgId,
      reviewer.repositoryId,
      reviewer.pullRequestNumber,
      reviewer.reviewerLogins,
    )
  }
  logger.info('upsert reviewers completed.', orgId)

  // 6. export (optional)
  if (organization.exportSetting) {
    logger.info('exporting to spreadsheet...', orgId)
    const exporter = createSpreadsheetExporter(organization.exportSetting)
    await exporter.exportPulls(pulls)
    await exporter.exportReviewResponses(reviewResponses)
    logger.info('export to spreadsheet done.', orgId)
  }

  return { pulls, reviewResponses }
}
