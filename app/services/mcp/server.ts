import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { getTenantDb } from '~/app/services/tenant-db.server'
import type { OrganizationId } from '~/app/types/organization'

export const createMcpServer = (organizationId: OrganizationId) => {
  const server = new McpServer({
    name: 'upflow',
    version: '0.1.0',
  })

  // 偵察用: 最小限の tool を1つだけ登録
  server.tool(
    'get_cycle_time_summary',
    'ステージ別サイクルタイム統計を返す。coding / pickup / review / deploy の各ステージの所要時間の平均と件数を集計する。',
    {
      period: z
        .enum(['7d', '14d', '30d', '90d', '180d', '365d'])
        .default('30d')
        .describe('集計期間'),
    },
    async ({ period }) => {
      const tenantDb = getTenantDb(organizationId)
      const days = Number.parseInt(period, 10)
      const since = new Date(Date.now() - days * 86400000).toISOString()

      const rows = await tenantDb
        .selectFrom('pullRequests')
        .select([
          'codingTime',
          'pickupTime',
          'reviewTime',
          'deployTime',
          'totalTime',
        ])
        .where('mergedAt', '>=', since)
        .where('mergedAt', 'is not', null)
        .execute()

      const avg = (vals: (number | null)[]) => {
        const nums = vals.filter((v): v is number => v != null)
        if (nums.length === 0) return null
        return Number(
          (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2),
        )
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                period,
                sampleSize: rows.length,
                averageDays: {
                  coding: avg(rows.map((r) => r.codingTime)),
                  pickup: avg(rows.map((r) => r.pickupTime)),
                  review: avg(rows.map((r) => r.reviewTime)),
                  deploy: avg(rows.map((r) => r.deployTime)),
                  total: avg(rows.map((r) => r.totalTime)),
                },
              },
              null,
              2,
            ),
          },
        ],
      }
    },
  )

  return server
}
