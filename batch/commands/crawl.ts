import consola from 'consola'
import { durably } from '~/app/services/durably.server'
import { requireOrganization } from './helpers'
import { shutdown } from './shutdown'

interface CrawlCommandProps {
  organizationId?: string
  refresh: boolean
  prNumbers?: number[]
}

export async function crawlCommand({
  organizationId,
  refresh,
  prNumbers,
}: CrawlCommandProps) {
  const result = await requireOrganization(organizationId)
  if (!result) return

  const { orgId } = result

  try {
    const prLabel = prNumbers
      ? ` (PRs: ${prNumbers.join(', ')})`
      : refresh
        ? ' (full refresh)'
        : ''
    consola.info(`Starting crawl for ${orgId}${prLabel}...`)

    const { output } = await durably.jobs.crawl.triggerAndWait(
      { organizationId: orgId, refresh, prNumbers },
      {
        concurrencyKey: `crawl:${orgId}`,
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
      `Crawl completed. ${output.fetchedRepos} repos, ${output.pullCount} PRs.`,
    )
  } finally {
    await durably.stop()
    await shutdown()
  }
}
