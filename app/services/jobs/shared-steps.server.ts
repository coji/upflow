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
import type {
  AnalyzedReview,
  AnalyzedReviewResponse,
  AnalyzedReviewer,
} from '~/batch/github/types'
import { classifyPullRequests } from '~/batch/usecases/classify-pull-requests'
import type { SqliteBusyEvent } from './run-in-worker'
import { runAnalyzeInWorker, runUpsertInWorker } from './run-in-worker'

interface AnalyzeResult {
  pulls: Selectable<TenantDB.PullRequests>[]
  reviews: AnalyzedReview[]
  reviewers: AnalyzedReviewer[]
  reviewResponses: AnalyzedReviewResponse[]
}

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

function formatDurationMs(durationMs: number) {
  if (durationMs < 1000) return `${durationMs}ms`
  return `${(durationMs / 1000).toFixed(1)}s`
}

function summarizeBusyEvents(events: SqliteBusyEvent[]) {
  if (events.length === 0) return null

  const retries = events.filter((event) => !event.gaveUp)
  const gaveUp = events.filter((event) => event.gaveUp)
  const totalWaitMs = retries.reduce((sum, event) => sum + event.delayMs, 0)
  const counts = new Map<string, number>()
  for (const event of events) {
    counts.set(event.entrypoint, (counts.get(event.entrypoint) ?? 0) + 1)
  }
  const byEntrypoint = [...counts.entries()]
    .map(([entrypoint, count]) => `${entrypoint}:${count}`)
    .join(', ')

  return `sqlite busy events=${events.length} retries=${retries.length} gaveUp=${gaveUp.length} totalWait=${formatDurationMs(totalWaitMs)} byWorker=[${byEntrypoint}]`
}

async function runTimedStep<T>(
  step: StepContext,
  name: string,
  action: () => Promise<T>,
) {
  const startedAt = Date.now()
  try {
    return await action()
  } finally {
    step.log.info(
      `${name} completed in ${formatDurationMs(Date.now() - startedAt)}`,
    )
  }
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
  const sqliteBusyEvents: SqliteBusyEvent[] = []

  for (let i = 0; i < organization.repositories.length; i++) {
    const repo = organization.repositories[i]
    if (skipRepo?.(repo.id)) continue

    const result = await step.run(`analyze:${repo.repo}`, async () => {
      return await runTimedStep(step, `analyze:${repo.repo}`, async () => {
        step.progress(i + 1, repoCount, `Analyzing ${repo.repo}...`)

        const orgSetting = organization.organizationSetting
        const prNumbers = filterPrNumbers?.get(repo.id)
        return await runAnalyzeInWorker<AnalyzeResult>(
          {
            organizationId: orgId,
            repositoryId: repo.id,
            releaseDetectionMethod:
              repo.releaseDetectionMethod ?? orgSetting.releaseDetectionMethod,
            releaseDetectionKey:
              repo.releaseDetectionKey ?? orgSetting.releaseDetectionKey,
            excludedUsers: orgSetting.excludedUsers,
            filterPrNumbers: prNumbers ? [...prNumbers] : undefined,
          },
          {
            onSqliteBusy: (event) => sqliteBusyEvents.push(event),
          },
        )
      })
    })
    allPulls.push(...result.pulls)
    allReviews.push(...result.reviews)
    allReviewers.push(...result.reviewers)
    allReviewResponses.push(...result.reviewResponses)
  }

  // Upsert
  if (runUpsert) {
    await step.run('upsert', async () => {
      await runTimedStep(step, 'upsert', async () => {
        step.progress(0, 0, 'Upserting to database...')
        await runUpsertInWorker(
          {
            organizationId: orgId,
            pulls: allPulls,
            reviews: allReviews,
            reviewers: allReviewers,
          },
          {
            onSqliteBusy: (event) => sqliteBusyEvents.push(event),
          },
        )
      })
    })
  }

  // Classify
  if (runClassify) {
    await step.run('classify', async () => {
      await runTimedStep(step, 'classify', async () => {
        step.progress(0, 0, 'Classifying PRs...')
        await classifyPullRequests(orgId)
      })
    })
  }

  // Export
  const { exportSetting } = organization
  if (runExport && exportSetting) {
    await step.run('export', async () => {
      await runTimedStep(step, 'export', async () => {
        step.progress(0, 0, 'Exporting to spreadsheet...')
        try {
          await exportPulls(exportSetting, allPulls)
          await exportReviewResponses(exportSetting, allReviewResponses)
        } catch (e) {
          step.log.warn(`Export failed: ${e instanceof Error ? e.message : e}`)
        }
      })
    })
  }

  // Finalize
  await step.run('finalize', async () => {
    await runTimedStep(step, 'finalize', async () => {
      step.progress(0, 0, 'Finalizing...')
      const tenantDb = getTenantDb(orgId)
      await sql`PRAGMA wal_checkpoint(TRUNCATE)`.execute(tenantDb)
      clearOrgCache(orgId)
    })
  })

  const busySummary = summarizeBusyEvents(sqliteBusyEvents)
  if (busySummary) {
    step.log.warn(busySummary)
  }

  return { pullCount: allPulls.length }
}
