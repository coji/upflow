import consola from 'consola'
import { durably } from '~/app/services/durably.server'
import { processConcurrencyKey } from '~/app/services/jobs/concurrency-keys.server'
import { requireOrganization } from './helpers'
import { shutdown } from './shutdown'

interface ProcessCommandProps {
  organizationId?: string
  export: boolean
}

export async function processCommand({
  organizationId,
  export: exportFlag,
}: ProcessCommandProps) {
  const result = await requireOrganization(organizationId)
  if (!result) return

  const { orgId } = result

  try {
    const steps = { upsert: true, export: exportFlag }
    const flags = [exportFlag ? 'export' : null].filter(Boolean)

    consola.info(
      `Starting process for ${orgId}${flags.length ? ` (+${flags.join(', ')})` : ''}...`,
    )

    const { output } = await durably.jobs.process.triggerAndWait(
      { organizationId: orgId, steps },
      {
        concurrencyKey: processConcurrencyKey(orgId),
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

    consola.success(`Process completed. ${output.pullCount} PRs updated.`)
  } finally {
    await durably.stop()
    await shutdown()
  }
}
