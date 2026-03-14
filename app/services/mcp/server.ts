import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { OrganizationId } from '~/app/types/organization'
import { registerBottleneckTools } from './tools/bottleneck-analysis'
import { registerFlowHealthTools } from './tools/flow-health'
import { registerOngoingWorkTools } from './tools/ongoing-work'
import { registerPrDetailTools } from './tools/pr-details'
import { registerTrendTools } from './tools/trend-comparison'

export const createMcpServer = (organizationId: OrganizationId) => {
  const server = new McpServer({
    name: 'upflow',
    version: '0.1.0',
  })

  // Level 0: 全体の健康状態（制約を見つける）
  registerFlowHealthTools(server, organizationId)

  // Level 1: 制約の深掘り（なぜ？を掘る）
  registerBottleneckTools(server, organizationId)

  // Level 2: 事実確認（エビデンス収集）
  registerOngoingWorkTools(server, organizationId)
  registerPrDetailTools(server, organizationId)

  // Level 3: 改善効果の追跡（制約は移動したか）
  registerTrendTools(server, organizationId)

  return server
}
