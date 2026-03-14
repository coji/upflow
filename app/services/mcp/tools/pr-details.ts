import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { getTenantDb } from '~/app/services/tenant-db.server'
import type { OrganizationId } from '~/app/types/organization'
import { jsonResponse } from './shared'

export const registerPrDetailTools = (
  server: McpServer,
  organizationId: OrganizationId,
) => {
  server.tool(
    'get_pr_timeline',
    `個別PRのタイムラインを詳細に返す。各ステージの所要時間、レビュー履歴、コードサイズを含む。
「このPRなぜ遅かった？」という問いに答えるために使う。
5 Whys の最後の「現場の事実」を確認するためのツール。`,
    {
      repo: z.string().describe('リポジトリ名（owner/repo 形式）'),
      number: z.number().describe('PR 番号'),
    },
    async ({ repo, number }) => {
      const tenantDb = getTenantDb(organizationId)

      // PR 本体
      const pr = await tenantDb
        .selectFrom('pullRequests')
        .innerJoin(
          'repositories',
          'pullRequests.repositoryId',
          'repositories.id',
        )
        .selectAll('pullRequests')
        .select(['repositories.repo', 'repositories.owner'])
        .where('repositories.repo', '=', repo)
        .where('pullRequests.number', '=', number)
        .executeTakeFirst()

      if (!pr) {
        return jsonResponse({ error: `PR #${number} not found in ${repo}` })
      }

      // レビュー履歴
      const reviews = await tenantDb
        .selectFrom('pullRequestReviews')
        .select(['reviewer', 'state', 'submittedAt'])
        .where('pullRequestNumber', '=', number)
        .where('repositoryId', '=', pr.repositoryId)
        .orderBy('submittedAt', 'asc')
        .execute()

      // レビュワー割り当て
      const reviewers = await tenantDb
        .selectFrom('pullRequestReviewers')
        .select(['reviewer', 'requestedAt'])
        .where('pullRequestNumber', '=', number)
        .where('repositoryId', '=', pr.repositoryId)
        .execute()

      return jsonResponse({
        repo: `${pr.owner}/${pr.repo}`,
        number: pr.number,
        title: pr.title,
        author: pr.author,
        url: pr.url,
        state: pr.state,
        size: {
          additions: pr.additions,
          deletions: pr.deletions,
          changedFiles: pr.changedFiles,
          total: (pr.additions ?? 0) + (pr.deletions ?? 0),
        },
        complexity: pr.complexity,
        complexityReason: pr.complexityReason,
        timeline: {
          firstCommittedAt: pr.firstCommittedAt,
          pullRequestCreatedAt: pr.pullRequestCreatedAt,
          firstReviewedAt: pr.firstReviewedAt,
          mergedAt: pr.mergedAt,
          releasedAt: pr.releasedAt,
        },
        cycleTimeDays: {
          coding: pr.codingTime,
          pickup: pr.pickupTime,
          review: pr.reviewTime,
          deploy: pr.deployTime,
          total: pr.totalTime,
        },
        reviewers: reviewers.map((r) => ({
          reviewer: r.reviewer,
          requestedAt: r.requestedAt,
        })),
        reviews: reviews.map((r) => ({
          reviewer: r.reviewer,
          state: r.state,
          submittedAt: r.submittedAt,
        })),
      })
    },
  )
}
