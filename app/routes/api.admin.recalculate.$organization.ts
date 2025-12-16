import invariant from 'tiny-invariant'
import {
  exportPullsToSpreadsheet,
  exportReviewResponsesToSpreadsheet,
} from '~/batch/bizlogic/export-spreadsheet'
import { getOrganization, upsertPullRequest } from '~/batch/db'
import { createProvider } from '~/batch/provider'
import type { Route } from './+types/api.admin.recalculate.$organization'

// 実行中の組織を追跡（同時実行防止）
const runningJobs = new Set<string>()

export const loader = async ({ params }: Route.LoaderArgs) => {
  const organizationId = params.organization
  invariant(organizationId, 'organization is required')

  // 同時実行チェック
  if (runningJobs.has(organizationId)) {
    return new Response(
      JSON.stringify({ error: 'Recalculation already in progress' }),
      {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }

  // SSE ストリームを作成
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      runningJobs.add(organizationId)

      try {
        send({ type: 'start', message: 'Starting recalculation...' })

        const organization = await getOrganization(organizationId)
        invariant(organization.integration, 'integration should related')
        invariant(
          organization.organizationSetting,
          'organization setting should related',
        )

        const provider = createProvider(organization.integration)
        invariant(
          provider,
          `unknown provider ${organization.integration.provider}`,
        )

        // analyze with progress callback
        const { pulls, reviewResponses } = await provider.analyze(
          organization.organizationSetting,
          organization.repositories,
          (progress) => {
            send({
              type: 'progress',
              repo: progress.repo,
              current: progress.current,
              total: progress.total,
            })
          },
        )

        send({ type: 'upsert', message: `Saving ${pulls.length} PRs...` })

        // upsert
        for (const pr of pulls) {
          await upsertPullRequest(pr)
        }

        // export to spreadsheet if configured
        if (organization.exportSetting) {
          send({ type: 'export', message: 'Exporting to spreadsheet...' })
          await exportPullsToSpreadsheet(pulls, organization.exportSetting)
          await exportReviewResponsesToSpreadsheet(
            reviewResponses,
            organization.exportSetting,
          )
        }

        send({
          type: 'complete',
          message: `Recalculation completed. ${pulls.length} PRs updated.`,
        })
      } catch (error) {
        send({
          type: 'error',
          message:
            error instanceof Error ? error.message : 'Unknown error occurred',
        })
      } finally {
        runningJobs.delete(organizationId)
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
