import consola from 'consola'
import { durably } from '~/app/services/durably.server'
import { requireOrganization } from './helpers'
import { shutdown } from './shutdown'

interface RecalculateCommandProps {
  organizationId?: string
  export: boolean
}

export async function recalculateCommand({
  organizationId,
  export: exportFlag,
}: RecalculateCommandProps) {
  const result = await requireOrganization(organizationId)
  if (!result) return

  const { orgId } = result

  try {
    const steps = { upsert: true, export: exportFlag }
    const flags = [exportFlag ? 'export' : null].filter(Boolean)

    consola.info(
      `Starting recalculate for ${orgId}${flags.length ? ` (+${flags.join(', ')})` : ''}...`,
    )

    const { output } = await durably.jobs.recalculate.triggerAndWait(
      { organizationId: orgId, steps },
      {
        concurrencyKey: `recalculate:${orgId}`,
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

    consola.success(`Recalculate completed. ${output.pullCount} PRs updated.`)
  } finally {
    await durably.stop()
    await shutdown()
  }
}
