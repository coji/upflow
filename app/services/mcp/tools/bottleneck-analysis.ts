import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { sql } from 'kysely'
import { getTenantDb } from '~/app/services/tenant-db.server'
import type { OrganizationId } from '~/app/types/organization'
import {
  avg,
  jsonResponse,
  periodSchema,
  repoSchema,
  sinceFromPeriod,
  teamSchema,
} from './shared'

export const registerBottleneckTools = (
  server: McpServer,
  organizationId: OrganizationId,
) => {
  server.tool(
    'get_bottleneck_analysis',
    `ボトルネックステージの原因を深掘りする。get_flow_healthで制約ステージを特定した後に使う。
レビューが遅い場合: レビュワー負荷の偏り、PRサイズとの相関を分析
ピックアップが遅い場合: レビュワー割り当ての偏りを分析
コーディングが遅い場合: PRサイズ（complexity）との相関を分析
「なぜ遅いか」を掘り下げ、症状ではなく根本原因を特定するための情報を提供する。`,
    {
      period: periodSchema,
      team: teamSchema,
      repo: repoSchema,
    },
    async ({ period, team, repo }) => {
      const tenantDb = getTenantDb(organizationId)
      const since = sinceFromPeriod(period)

      // マージ済みPR + レビュー情報
      let query = tenantDb
        .selectFrom('pullRequests')
        .innerJoin(
          'repositories',
          'pullRequests.repositoryId',
          'repositories.id',
        )
        .select([
          'pullRequests.number',
          'pullRequests.repositoryId',
          'pullRequests.author',
          'pullRequests.title',
          'pullRequests.codingTime',
          'pullRequests.pickupTime',
          'pullRequests.reviewTime',
          'pullRequests.deployTime',
          'pullRequests.totalTime',
          'pullRequests.additions',
          'pullRequests.deletions',
          'pullRequests.complexity',
          'repositories.repo',
        ])
        .where('pullRequests.mergedAt', '>=', since)
        .where('pullRequests.mergedAt', 'is not', null)

      if (repo) query = query.where('repositories.repo', '=', repo)
      if (team)
        query = query
          .innerJoin('teams', 'repositories.teamId', 'teams.id')
          .where('teams.name', '=', team)

      const prs = await query.execute()

      // レビュワー別の負荷分析
      const reviewerStats = await tenantDb
        .selectFrom('pullRequestReviewers')
        .innerJoin('pullRequests', (join) =>
          join
            .onRef(
              'pullRequestReviewers.pullRequestNumber',
              '=',
              'pullRequests.number',
            )
            .onRef(
              'pullRequestReviewers.repositoryId',
              '=',
              'pullRequests.repositoryId',
            ),
        )
        .select([
          'pullRequestReviewers.reviewer',
          sql<number>`count(*)`.as('reviewCount'),
          sql<number>`avg(${sql.ref('pullRequests.pickupTime')})`.as(
            'avgPickupTime',
          ),
        ])
        .where('pullRequests.mergedAt', '>=', since)
        .where('pullRequests.mergedAt', 'is not', null)
        .groupBy('pullRequestReviewers.reviewer')
        .orderBy(sql`count(*)`, 'desc')
        .execute()

      // complexity 別のサイクルタイム
      const byComplexity: Record<
        string,
        { count: number; avgTotal: number | null; avgReview: number | null }
      > = {}
      for (const pr of prs) {
        const c = pr.complexity ?? 'unclassified'
        if (!byComplexity[c])
          byComplexity[c] = { count: 0, avgTotal: null, avgReview: null }
        byComplexity[c].count++
      }
      for (const [c, data] of Object.entries(byComplexity)) {
        const matching = prs.filter(
          (p) => (p.complexity ?? 'unclassified') === c,
        )
        data.avgTotal = avg(matching.map((p) => p.totalTime))
        data.avgReview = avg(matching.map((p) => p.reviewTime))
      }

      // レビュワー集中度（上位N人が全体の何%を占めるか）
      const totalReviews = reviewerStats.reduce(
        (sum, r) => sum + r.reviewCount,
        0,
      )
      const top2Reviews = reviewerStats
        .slice(0, 2)
        .reduce((sum, r) => sum + r.reviewCount, 0)
      const reviewConcentration =
        totalReviews > 0
          ? Number(((top2Reviews / totalReviews) * 100).toFixed(1))
          : 0

      // PRサイズ（additions + deletions）と review time の相関
      const sizeVsReview = prs
        .filter((p) => p.reviewTime != null && p.additions != null)
        .map((p) => ({
          size: (p.additions ?? 0) + (p.deletions ?? 0),
          reviewTime: p.reviewTime as number,
        }))

      const largePrThreshold = 500
      const largePrs = sizeVsReview.filter((p) => p.size >= largePrThreshold)
      const smallPrs = sizeVsReview.filter((p) => p.size < largePrThreshold)

      return jsonResponse({
        period,
        sampleSize: prs.length,
        reviewerWorkload: reviewerStats.slice(0, 10).map((r) => ({
          reviewer: r.reviewer,
          reviewCount: r.reviewCount,
          avgPickupTimeDays: r.avgPickupTime
            ? Number(Number(r.avgPickupTime).toFixed(2))
            : null,
        })),
        reviewConcentration: {
          top2Percentage: reviewConcentration,
          interpretation:
            reviewConcentration > 60
              ? 'レビューが少数のメンバーに集中している。負荷分散が必要'
              : reviewConcentration > 40
                ? 'やや集中傾向。チーム全体でのレビュー参加を促進すべき'
                : 'レビュー負荷は適度に分散されている',
        },
        prSizeImpact: {
          largePrs: {
            count: largePrs.length,
            avgReviewTimeDays: avg(largePrs.map((p) => p.reviewTime)),
          },
          smallPrs: {
            count: smallPrs.length,
            avgReviewTimeDays: avg(smallPrs.map((p) => p.reviewTime)),
          },
          interpretation:
            largePrs.length > 0 && smallPrs.length > 0
              ? `${largePrThreshold}行以上のPRの平均レビュー時間は${String(avg(largePrs.map((p) => p.reviewTime)))}日、${String(largePrThreshold)}行未満は${String(avg(smallPrs.map((p) => p.reviewTime)))}日`
              : 'データ不足',
        },
        byComplexity,
      })
    },
  )
}
