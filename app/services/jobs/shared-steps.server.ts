/**
 * crawl と recalculate ジョブで共有する analyze → upsert → classify → export → finalize ステップ群
 */
import type { StepContext } from '@coji/durably'
import { sql, type Selectable } from 'kysely'
import { clearOrgCache } from '~/app/services/cache.server'
import { getTenantDb, type TenantDB } from '~/app/services/tenant-db.server'
import type { OrganizationId } from '~/app/types/organization'
import {
  exportPulls,
  exportReviewResponses,
} from '~/batch/bizlogic/export-spreadsheet'
import { upsertAnalyzedData } from '~/batch/db'
import { buildPullRequests } from '~/batch/github/pullrequest'
import { createStore } from '~/batch/github/store'
import type {
  AnalyzedReview,
  AnalyzedReviewResponse,
  AnalyzedReviewer,
} from '~/batch/github/types'
import { classifyPullRequests } from '~/batch/usecases/classify-pull-requests'

interface OrganizationData {
  organizationSetting: Pick<
    Selectable<TenantDB.OrganizationSettings>,
    'releaseDetectionMethod' | 'releaseDetectionKey' | 'excludedUsers'
  >
  repositories: Selectable<TenantDB.Repositories>[]
  exportSetting?: Selectable<TenantDB.ExportSettings> | null
}

export interface JobSteps {
  upsert?: boolean
  classify?: boolean
  export?: boolean
}

interface AnalyzeAndFinalizeOptions {
  /** PR 番号フィルタ（undefined なら全件解析） */
  filterPrNumbers?: Map<string, Set<number>>
  /** リポジトリ単位のスキップ判定 */
  skipRepo?: (repoId: string) => boolean
  /** 各フェーズを実行するか（デフォルト全て true） */
  steps?: JobSteps
}

/**
 * analyze → upsert → classify → export → finalize の共通パイプライン。
 * durably の step context を受け取り、ステップ名付きで実行する。
 */
export async function analyzeAndFinalizeSteps(
  step: StepContext,
  orgId: OrganizationId,
  organization: OrganizationData,
  options: AnalyzeAndFinalizeOptions = {},
) {
  const { filterPrNumbers, skipRepo, steps: stepFlags } = options
  const runUpsert = stepFlags?.upsert ?? true
  const runClassify = stepFlags?.classify ?? true
  const runExport = stepFlags?.export ?? true

  // Analyze repos (per-repository steps)
  const repoCount = organization.repositories.length
  const allPulls: Selectable<TenantDB.PullRequests>[] = []
  const allReviews: AnalyzedReview[] = []
  const allReviewers: AnalyzedReviewer[] = []
  const allReviewResponses: AnalyzedReviewResponse[] = []

  for (let i = 0; i < organization.repositories.length; i++) {
    const repo = organization.repositories[i]
    if (skipRepo?.(repo.id)) continue

    const result = await step.run(`analyze:${repo.repo}`, async () => {
      step.progress(i + 1, repoCount, `Analyzing ${repo.repo}...`)

      const store = createStore({
        organizationId: orgId,
        repositoryId: repo.id,
      })
      await store.preloadAll()

      const orgSetting = organization.organizationSetting
      return await buildPullRequests(
        {
          organizationId: orgId,
          repositoryId: repo.id,
          releaseDetectionMethod:
            repo.releaseDetectionMethod ?? orgSetting.releaseDetectionMethod,
          releaseDetectionKey:
            repo.releaseDetectionKey ?? orgSetting.releaseDetectionKey,
          excludedUsers: orgSetting.excludedUsers,
        },
        await store.loader.pullrequests(),
        store.loader,
        filterPrNumbers?.get(repo.id),
      )
    })
    allPulls.push(...result.pulls)
    allReviews.push(...result.reviews)
    allReviewers.push(...result.reviewers)
    allReviewResponses.push(...result.reviewResponses)
  }

  // Upsert
  if (runUpsert) {
    await step.run('upsert', async () => {
      step.progress(0, 0, 'Upserting to database...')
      await upsertAnalyzedData(orgId, {
        pulls: allPulls,
        reviews: allReviews,
        reviewers: allReviewers,
      })
    })
  }

  // Classify
  if (runClassify) {
    await step.run('classify', async () => {
      step.progress(0, 0, 'Classifying PRs...')
      await classifyPullRequests(orgId)
    })
  }

  // Export
  const { exportSetting } = organization
  if (runExport && exportSetting) {
    await step.run('export', async () => {
      step.progress(0, 0, 'Exporting to spreadsheet...')
      try {
        await exportPulls(exportSetting, allPulls)
        await exportReviewResponses(exportSetting, allReviewResponses)
      } catch (e) {
        step.log.warn(`Export failed: ${e instanceof Error ? e.message : e}`)
      }
    })
  }

  // Finalize
  await step.run('finalize', async () => {
    step.progress(0, 0, 'Finalizing...')
    const tenantDb = getTenantDb(orgId)
    await sql`PRAGMA wal_checkpoint(TRUNCATE)`.execute(tenantDb)
    clearOrgCache(orgId)
  })

  return { pullCount: allPulls.length }
}
