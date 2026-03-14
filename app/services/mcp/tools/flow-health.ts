import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { sql } from 'kysely'
import { getTenantDb } from '~/app/services/tenant-db.server'
import type { OrganizationId } from '~/app/types/organization'
import {
  avg,
  jsonResponse,
  percentile,
  periodSchema,
  repoSchema,
  sinceFromPeriod,
  teamSchema,
} from './shared'

export const registerFlowHealthTools = (
  server: McpServer,
  organizationId: OrganizationId,
) => {
  server.tool(
    'get_flow_health',
    `フロー全体の健康診断を行う。ToC（制約理論）に基づき、開発フローのどのステージが制約（ボトルネック）になっているかを特定する。
各ステージ（coding→pickup→review→deploy）の所要時間の比率、WIPとスループットの関係、Little's Lawからの乖離を分析する。
まずこのツールで全体像を把握し、ボトルネックが見つかったらget_bottleneck_analysisで深掘りする。`,
    {
      period: periodSchema,
      team: teamSchema,
      repo: repoSchema,
    },
    async ({ period, team, repo }) => {
      const tenantDb = getTenantDb(organizationId)
      const since = sinceFromPeriod(period)

      // マージ済みPRのサイクルタイムデータ
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
        ])
        .where('pullRequests.mergedAt', '>=', since)
        .where('pullRequests.mergedAt', 'is not', null)

      if (repo) query = query.where('repositories.repo', '=', repo)
      if (team)
        query = query
          .innerJoin('teams', 'repositories.teamId', 'teams.id')
          .where('teams.name', '=', team)

      const merged = await query.execute()

      // 現在の WIP（オープンPR数）
      let wipQuery = tenantDb
        .selectFrom('pullRequests')
        .innerJoin(
          'repositories',
          'pullRequests.repositoryId',
          'repositories.id',
        )
        .select(sql<number>`count(*)`.as('count'))
        .where('pullRequests.mergedAt', 'is', null)
        .where('pullRequests.state', '=', 'open')

      if (repo) wipQuery = wipQuery.where('repositories.repo', '=', repo)
      if (team)
        wipQuery = wipQuery
          .innerJoin('teams', 'repositories.teamId', 'teams.id')
          .where('teams.name', '=', team)

      const wipResult = await wipQuery.executeTakeFirstOrThrow()
      const currentWip = wipResult.count

      // ステージ別平均
      const stages = {
        coding: avg(merged.map((r) => r.codingTime)),
        pickup: avg(merged.map((r) => r.pickupTime)),
        review: avg(merged.map((r) => r.reviewTime)),
        deploy: avg(merged.map((r) => r.deployTime)),
      }

      // ボトルネック特定
      const stageEntries = Object.entries(stages).filter(
        ([, v]) => v != null,
      ) as [string, number][]
      const total = stageEntries.reduce((sum, [, v]) => sum + v, 0)
      const bottleneck = stageEntries.sort(([, a], [, b]) => b - a)[0]

      // スループット（PRs / 日）
      const days = Number.parseInt(period, 10)
      const throughput =
        merged.length > 0 ? Number((merged.length / days).toFixed(2)) : 0

      // Little's Law: 理想リードタイム = WIP / スループット
      const littleLawLeadTime =
        throughput > 0 ? Number((currentWip / throughput).toFixed(1)) : null
      const actualLeadTime = avg(merged.map((r) => r.totalTime))

      return jsonResponse({
        period,
        sampleSize: merged.length,
        currentWip,
        throughputPerDay: throughput,
        stageAverageDays: stages,
        bottleneck: bottleneck
          ? {
              stage: bottleneck[0],
              averageDays: bottleneck[1],
              percentOfTotal:
                total > 0
                  ? Number(((bottleneck[1] / total) * 100).toFixed(1))
                  : 0,
            }
          : null,
        littlesLaw: {
          predictedLeadTimeDays: littleLawLeadTime,
          actualLeadTimeDays: actualLeadTime,
          interpretation:
            littleLawLeadTime && actualLeadTime
              ? littleLawLeadTime > actualLeadTime * 1.3
                ? 'WIPが多すぎる可能性。WIPを減らすことでリードタイムが改善する'
                : littleLawLeadTime < actualLeadTime * 0.7
                  ? 'フローに阻害要因がある。待ち時間やブロッカーを調査すべき'
                  : 'WIPとスループットのバランスは適正'
              : 'データ不足で判定不可',
        },
        percentiles: {
          totalTime: {
            p50: percentile(
              merged
                .map((r) => r.totalTime)
                .filter((v): v is number => v != null),
              0.5,
            ),
            p75: percentile(
              merged
                .map((r) => r.totalTime)
                .filter((v): v is number => v != null),
              0.75,
            ),
            p90: percentile(
              merged
                .map((r) => r.totalTime)
                .filter((v): v is number => v != null),
              0.9,
            ),
          },
        },
      })
    },
  )
}
