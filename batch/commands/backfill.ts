import consola from 'consola'
import { durably } from '~/app/services/durably.server'
import { requireOrganization } from './helpers'
import { shutdown } from './shutdown'

interface BackfillCommandProps {
  organizationId?: string
  files?: boolean
}

export async function backfillCommand(props: BackfillCommandProps) {
  const result = await requireOrganization(props.organizationId)
  if (!result) return

  const { orgId } = result

  try {
    consola.info(
      `Starting backfill for ${orgId}${props.files ? ' (files only)' : ''}...`,
    )

    const { output } = await durably.jobs.backfill.triggerAndWait(
      { organizationId: orgId, files: props.files ?? false },
      {
        concurrencyKey: `backfill:${orgId}`,
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
      `Backfill completed for ${output.repositoryCount} repositories. Run \`recalculate\` to apply changes.`,
    )
  } finally {
    await durably.stop()
    await shutdown()
  }
}
