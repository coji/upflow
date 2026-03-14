import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { getTenantDb } from '~/app/services/tenant-db.server'
import type { OrganizationId } from '~/app/types/organization'
import {
  avg,
  jsonResponse,
  parsePeriodDays,
  percentile,
  repoSchema,
  sinceFromPeriod,
  teamSchema,
} from './shared'

export const registerTrendTools = (
  server: McpServer,
  organizationId: OrganizationId,
) => {
  server.tool(
    'get_trend_comparison',
    `2つの期間のメトリクスを比較する。施策の効果測定や、制約が移動したかの確認に使う。
ToC の最後のステップ「制約が移動したか確認する」を実行するためのツール。
例: PRサイズ制限を導入した前後、レビュー体制変更の前後を比較する。`,
    {
      current_period: z
        .enum(['7d', '14d', '30d', '90d'])
        .describe('現在の期間'),
      previous_period: z
        .enum(['7d', '14d', '30d', '90d'])
        .describe('比較対象の過去の期間（current_periodの直前）'),
      team: teamSchema,
      repo: repoSchema,
    },
    async ({ current_period, previous_period, team, repo }) => {
      const tenantDb = getTenantDb(organizationId)

      const currentSince = sinceFromPeriod(current_period)
      const previousDays =
        parsePeriodDays(current_period) + parsePeriodDays(previous_period)
      const previousSince = new Date(
        Date.now() - previousDays * 86400000,
      ).toISOString()

      const fetchPeriod = (since: string, until: string) => {
        let query = tenantDb
          .selectFrom('pullRequests')
          .innerJoin(
            'repositories',
            'pullRequests.repositoryId',
            'repositories.id',
          )
          .select([
            'pullRequests.codingTime',
            'pullRequests.pickupTime',
            'pullRequests.reviewTime',
            'pullRequests.deployTime',
            'pullRequests.totalTime',
            'pullRequests.additions',
            'pullRequests.deletions',
          ])
          .where('pullRequests.mergedAt', '>=', since)
          .where('pullRequests.mergedAt', '<', until)
          .where('pullRequests.mergedAt', 'is not', null)

        if (repo) query = query.where('repositories.repo', '=', repo)
        if (team)
          query = query
            .innerJoin('teams', 'repositories.teamId', 'teams.id')
            .where('teams.name', '=', team)

        return query.execute()
      }

      const currentData = await fetchPeriod(
        currentSince,
        new Date().toISOString(),
      )
      const previousData = await fetchPeriod(previousSince, currentSince)

      const summarize = (
        data: Array<{
          codingTime: number | null
          pickupTime: number | null
          reviewTime: number | null
          deployTime: number | null
          totalTime: number | null
          additions: number | null
          deletions: number | null
        }>,
      ) => {
        const totals = data
          .map((r) => r.totalTime)
          .filter((v): v is number => v != null)
        return {
          count: data.length,
          avgDays: {
            coding: avg(data.map((r) => r.codingTime)),
            pickup: avg(data.map((r) => r.pickupTime)),
            review: avg(data.map((r) => r.reviewTime)),
            deploy: avg(data.map((r) => r.deployTime)),
            total: avg(data.map((r) => r.totalTime)),
          },
          p75TotalDays: percentile(totals, 0.75),
          avgPrSize: avg(
            data.map((r) =>
              r.additions != null
                ? (r.additions ?? 0) + (r.deletions ?? 0)
                : null,
            ),
          ),
        }
      }

      const current = summarize(currentData)
      const previous = summarize(previousData)

      // 変化率を計算
      const changeRate = (cur: number | null, prev: number | null) => {
        if (cur == null || prev == null || prev === 0) return null
        return Number((((cur - prev) / prev) * 100).toFixed(1))
      }

      // ボトルネックの移動を検出
      const currentBottleneck = Object.entries(current.avgDays)
        .filter(([k]) => k !== 'total')
        .filter(([, v]) => v != null)
        .sort(([, a], [, b]) => (b ?? 0) - (a ?? 0))[0]
      const previousBottleneck = Object.entries(previous.avgDays)
        .filter(([k]) => k !== 'total')
        .filter(([, v]) => v != null)
        .sort(([, a], [, b]) => (b ?? 0) - (a ?? 0))[0]

      return jsonResponse({
        current: { period: current_period, ...current },
        previous: { period: previous_period, ...previous },
        changes: {
          totalTimeChange: changeRate(
            current.avgDays.total,
            previous.avgDays.total,
          ),
          codingChange: changeRate(
            current.avgDays.coding,
            previous.avgDays.coding,
          ),
          pickupChange: changeRate(
            current.avgDays.pickup,
            previous.avgDays.pickup,
          ),
          reviewChange: changeRate(
            current.avgDays.review,
            previous.avgDays.review,
          ),
          deployChange: changeRate(
            current.avgDays.deploy,
            previous.avgDays.deploy,
          ),
          unit: 'percent (negative = improvement)',
        },
        bottleneckShift: {
          previous: previousBottleneck?.[0] ?? null,
          current: currentBottleneck?.[0] ?? null,
          shifted: previousBottleneck?.[0] !== currentBottleneck?.[0],
          interpretation:
            previousBottleneck?.[0] !== currentBottleneck?.[0]
              ? `制約が ${previousBottleneck?.[0]} → ${currentBottleneck?.[0]} に移動した。新しい制約に注力すべき`
              : `制約は依然として ${currentBottleneck?.[0]} にある`,
        },
      })
    },
  )
}
