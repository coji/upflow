import consola from 'consola'
import { durably } from '~/app/services/durably.server'
import { requireOrganization } from './helpers'
import { shutdown } from './shutdown'

interface ClassifyCommandProps {
  organizationId?: string
  force?: boolean
  limit?: number
}

export async function classifyCommand({
  organizationId,
  force,
  limit,
}: ClassifyCommandProps) {
  const result = await requireOrganization(organizationId)
  if (!result) return

  const { orgId } = result

  try {
    const flags = [
      force ? 'force' : null,
      limit ? `limit=${limit}` : null,
    ].filter(Boolean)
    consola.info(
      `Classifying PRs for ${orgId}${flags.length ? ` (${flags.join(', ')})` : ''}`,
    )

    const { output } = await durably.jobs.classify.triggerAndWait(
      { organizationId: orgId, force: force ?? false, limit },
      {
        concurrencyKey: `classify:${orgId}`,
        labels: { organizationId: orgId },
        onProgress: (p) => {
          if (p.message) consola.info(p.message)
        },
        onLog: (l) => {
          if (l.level === 'error') consola.error(l.message)
          else if (l.level === 'warn') consola.warn(l.message)
          else consola.info(l.message)
        },
      },
    )

    consola.success(
      `Classification completed: ${output.classifiedCount} PRs classified.`,
    )
  } finally {
    await durably.stop()
    await shutdown()
  }
}
