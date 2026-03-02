import {
  getTenantDb,
  type OrganizationId,
} from '~/app/services/tenant-db.server'
import { logger } from '~/batch/helper/logger'
import { batchClassifyPRs } from '~/batch/lib/llm-classify'
import type { ShapedGitHubPullRequest } from '~/batch/provider/github/model'

/**
 * 未分類の PR を LLM で分類し、結果を DB に保存する。
 * analyzeAndUpsert の後に呼び出す。
 *
 * GEMINI_API_KEY が未設定の場合はスキップする。
 */
export async function classifyPullRequests(
  organizationId: OrganizationId,
  options?: { force?: boolean },
) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    logger.info(
      'GEMINI_API_KEY not set, skipping LLM classification',
      organizationId,
    )
    return
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

  const unclassifiedPRs = await query.execute()

  if (unclassifiedPRs.length === 0) {
    logger.info('No PRs to classify', organizationId)
    return
  }

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

  // 3. LLM で分類
  const result = await batchClassifyPRs(prInputs, { apiKey })

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
        classifierModel: 'gemini-2.5-flash-lite',
      })
      .where('number', '=', pr.number)
      .where('repositoryId', '=', pr.repositoryId)
      .execute()
  }

  logger.info(
    `Classification complete: ${result.successCount} success, ${result.errorCount} errors, cost $${result.estimatedCost.toFixed(4)}`,
    organizationId,
  )
}
