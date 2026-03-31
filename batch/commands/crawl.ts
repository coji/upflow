import consola from 'consola'
import type { Selectable } from 'kysely'
import { durably } from '~/app/services/durably.server'
import type { TenantDB } from '~/app/services/tenant-db.server'
import { requireOrganization } from './helpers'
import { shutdown } from './shutdown'

interface CrawlCommandProps {
  organizationId?: string
  refresh: boolean
  prNumbers?: number[]
  /** `owner/repo` or repository row id */
  repository?: string
}

function resolveRepositoryId(
  repositories: Selectable<TenantDB.Repositories>[],
  spec: string,
): string | undefined {
  const slash = spec.indexOf('/')
  if (slash !== -1) {
    const owner = spec.slice(0, slash)
    const repo = spec.slice(slash + 1)
    return repositories.find((r) => r.owner === owner && r.repo === repo)?.id
  }
  return repositories.find((r) => r.id === spec)?.id
}

export async function crawlCommand({
  organizationId,
  refresh,
  prNumbers,
  repository,
}: CrawlCommandProps) {
  const result = await requireOrganization(organizationId)
  if (!result) return

  const { orgId, organization } = result

  let repositoryId: string | undefined
  if (repository) {
    repositoryId = resolveRepositoryId(organization.repositories, repository)
    if (!repositoryId) {
      consola.error(`Repository not found for this organization: ${repository}`)
      return
    }
  }

  if (prNumbers?.length && !repositoryId) {
    consola.error('--repository (owner/repo or id) is required when using --pr')
    return
  }

  try {
    const labels: string[] = []
    if (repository) labels.push(`repository: ${repository}`)
    if (prNumbers) labels.push(`PRs: ${prNumbers.join(', ')}`)
    if (refresh) labels.push('full refresh')
    const label = labels.length > 0 ? ` (${labels.join(', ')})` : ''
    consola.info(`Starting crawl for ${orgId}${label}...`)

    const { output } = await durably.jobs.crawl.triggerAndWait(
      {
        organizationId: orgId,
        refresh,
        prNumbers,
        repositoryId,
      },
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
      `Crawl completed. ${output.fetchedRepos} repos, ${output.pullCount} PRs fetched.`,
    )
  } finally {
    await durably.stop()
    await shutdown()
  }
}
