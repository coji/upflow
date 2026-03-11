import { sql, type Selectable } from 'kysely'
import { getTenantDb, type TenantDB } from '~/app/services/tenant-db.server'
import type { OrganizationId } from '~/app/types/organization'
import {
  exportPulls,
  exportReviewResponses,
} from '~/batch/bizlogic/export-spreadsheet'
import {
  batchUpsertPullRequestReviews,
  batchUpsertPullRequests,
  upsertCompanyGithubUsers,
  upsertPullRequestReviewers,
} from '~/batch/db'
import { analyzeRepos } from '~/batch/github/analyze-repos'
import { logger } from '~/batch/helper/logger'
import { classifyPullRequests } from './classify-pull-requests'

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
  /** リポジトリID → 更新PR番号セット。undefined なら全件処理 */
  updatedPrNumbers?: Map<string, Set<number>>
}

/**
 * PR 解析 → DB upsert → スプレッドシート export を行うユースケース
 */
export async function analyzeAndUpsert({
  organization,
  updatedPrNumbers,
}: AnalyzeAndUpsertParams) {
  const orgId = organization.id

  // 1. analyze
  logger.info('analyze started...', orgId)
  const { pulls, reviews, reviewers, reviewResponses } = await analyzeRepos(
    orgId,
    organization.organizationSetting,
    organization.repositories,
    undefined,
    updatedPrNumbers,
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
    for (const r of reviewer.reviewers) {
      if (r.login) discoveredLogins.add(r.login)
    }
  }
  await upsertCompanyGithubUsers(orgId, [...discoveredLogins])
  logger.info('auto-register github users completed.', orgId)

  // 3. upsert pull requests
  logger.info('upsert started...', orgId)
  await batchUpsertPullRequests(orgId, pulls)
  logger.info('upsert pull requests completed.', orgId)

  // 4. upsert reviews
  logger.info('upsert reviews started...', orgId)
  await batchUpsertPullRequestReviews(
    orgId,
    reviews.map((r) => ({
      id: r.id,
      pullRequestNumber: r.pullRequestNumber,
      repositoryId: r.repositoryId,
      reviewer: r.reviewer,
      state: r.state,
      submittedAt: r.submittedAt,
      url: r.url,
    })),
  )
  logger.info('upsert reviews completed.', orgId)

  // 5. upsert reviewers
  logger.info('upsert reviewers started...', orgId)
  for (const reviewer of reviewers) {
    await upsertPullRequestReviewers(
      orgId,
      reviewer.repositoryId,
      reviewer.pullRequestNumber,
      reviewer.reviewers,
    )
  }
  logger.info('upsert reviewers completed.', orgId)

  // 6. classify PRs with LLM (optional, requires GEMINI_API_KEY)
  await classifyPullRequests(orgId)

  // 7. export (optional)
  if (organization.exportSetting) {
    try {
      logger.info('exporting to spreadsheet...', orgId)
      await exportPulls(organization.exportSetting, pulls)
      await exportReviewResponses(organization.exportSetting, reviewResponses)
      logger.info('export to spreadsheet done.', orgId)
    } catch (e) {
      logger.error('export to spreadsheet failed.', orgId, e)
    }
  }

  // 8. WAL checkpoint to prevent WAL file from growing unbounded
  const tenantDb = getTenantDb(orgId)
  await sql`PRAGMA wal_checkpoint(TRUNCATE)`.execute(tenantDb)
  logger.info('WAL checkpoint completed.', orgId)

  return { pulls, reviewResponses }
}
