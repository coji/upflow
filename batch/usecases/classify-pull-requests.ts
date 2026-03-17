import { getTenantDb } from '~/app/services/tenant-db.server'
import type { OrganizationId } from '~/app/types/organization'
import type { ShapedGitHubPullRequest } from '~/batch/github/model'
import { logger } from '~/batch/helper/logger'

/**
 * 未分類の PR を LLM で分類し、結果を DB に保存する。
 * durably ジョブの classify ステップから呼び出す。
 *
 * GEMINI_API_KEY が未設定の場合はスキップする。
 */
export async function classifyPullRequests(
  organizationId: OrganizationId,
  options?: { force?: boolean; limit?: number },
): Promise<{ classifiedCount: number }> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    logger.info(
      'GEMINI_API_KEY not set, skipping LLM classification',
      organizationId,
    )
    return { classifiedCount: 0 }
  }

  const tenantDb = getTenantDb(organizationId)

  // 1. 未分類の PR を取得（force=true なら全件）
  let query = tenantDb
    .selectFrom('pullRequests')
    .innerJoin('githubRawData', (join) =>
      join
        .onRef('pullRequests.number', '=', 'githubRawData.pullRequestNumber')
        .onRef('pullRequests.repositoryId', '=', 'githubRawData.repositoryId'),
    )
    .select([
      'pullRequests.number',
      'pullRequests.repositoryId',
      'pullRequests.title',
      'pullRequests.author',
      'pullRequests.additions',
      'pullRequests.deletions',
      'pullRequests.changedFiles',
      'githubRawData.pullRequest as rawPullRequest',
    ])

  if (!options?.force) {
    query = query.where('pullRequests.classifiedAt', 'is', null)
  }

  if (options?.limit) {
    query = query.limit(options.limit)
  }

  const unclassifiedPRs = await query.execute()

  if (unclassifiedPRs.length === 0) {
    logger.info('No PRs to classify', organizationId)
    return { classifiedCount: 0 }
  }

  const orgSettings = await tenantDb
    .selectFrom('organizationSettings')
    .select('language')
    .executeTakeFirst()

  logger.info(`Classifying ${unclassifiedPRs.length} PRs...`, organizationId)

  // 2. rawPullRequest から files を抽出して分類用の入力を作成
  const prInputs = unclassifiedPRs.flatMap((pr) => {
    try {
      const raw = (
        typeof pr.rawPullRequest === 'string'
          ? JSON.parse(pr.rawPullRequest)
          : pr.rawPullRequest
      ) as ShapedGitHubPullRequest

      return [
        {
          number: pr.number,
          repositoryId: pr.repositoryId,
          title: pr.title,
          author: pr.author,
          body: raw.body ?? null,
          sourceBranch: raw.sourceBranch ?? null,
          targetBranch: raw.targetBranch ?? null,
          additions: pr.additions,
          deletions: pr.deletions,
          changedFiles: pr.changedFiles,
          files: raw.files ?? [],
        },
      ]
    } catch (err) {
      logger.warn(
        `Skipping PR #${pr.number} in ${pr.repositoryId}: invalid rawPullRequest (${err instanceof Error ? err.message : String(err)})`,
      )
      return []
    }
  })

  // 3. LLM で分類（lazy import to avoid loading Gemini SDK until needed）
  const { batchClassifyPRs } = await import('~/batch/lib/llm-classify')
  const result = await batchClassifyPRs(prInputs, {
    apiKey,
    language: orgSettings?.language,
  })

  // 4. 結果を DB に保存
  const now = new Date().toISOString()
  for (const pr of prInputs) {
    const classification = result.results.get(`${pr.repositoryId}#${pr.number}`)
    if (!classification) continue

    await tenantDb
      .updateTable('pullRequests')
      .set({
        complexity: classification.complexity,
        complexityReason: classification.reason,
        riskAreas: JSON.stringify(classification.risk_areas),
        classifiedAt: now,
        classifierModel: result.model,
      })
      .where('number', '=', pr.number)
      .where('repositoryId', '=', pr.repositoryId)
      .execute()
  }

  logger.info(
    `Classification complete: ${result.successCount} success, ${result.errorCount} errors, cost $${result.estimatedCost.toFixed(4)}`,
    organizationId,
  )

  return { classifiedCount: result.successCount }
}
