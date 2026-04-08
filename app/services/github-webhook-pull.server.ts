import { db } from '~/app/services/db.server'
import {
  findActiveLinkByInstallation,
  isRecord,
  readInstallation,
} from '~/app/services/github-webhook-shared.server'
import { crawlConcurrencyKey } from '~/app/services/jobs/concurrency-keys.server'
import { getTenantDb } from '~/app/services/tenant-db.server'
import type { OrganizationId } from '~/app/types/organization'

function extractPullRequestNumber(
  payload: Record<string, unknown>,
): number | null {
  const pr = payload.pull_request
  if (!isRecord(pr) || typeof pr.number !== 'number') return null
  return pr.number
}

function readRepositoryOwnerName(
  payload: Record<string, unknown>,
): { owner: string; name: string } | null {
  const repo = payload.repository
  if (!isRecord(repo)) return null
  const name = typeof repo.name === 'string' ? repo.name : null
  const ownerObj = repo.owner
  const owner =
    isRecord(ownerObj) && typeof ownerObj.login === 'string'
      ? ownerObj.login
      : null
  if (!name || !owner) return null
  return { owner, name }
}

export async function handlePullWebhookEvent(
  _event: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const installation = readInstallation(payload)
  if (!installation) return

  const link = await findActiveLinkByInstallation(db, installation.id)
  if (!link) return

  const orgId = link.organizationId as OrganizationId

  const coords = readRepositoryOwnerName(payload)
  if (!coords) return

  const prNumber = extractPullRequestNumber(payload)
  if (prNumber === null) return

  const tenantDb = getTenantDb(orgId)
  // Match by `(owner, repo)` *and* the installation that delivered the
  // webhook. `github_installation_id IS NULL` is still accepted while
  // existing rows are unbackfilled; the strict variant drops the OR clause.
  const repo = await tenantDb
    .selectFrom('repositories')
    .select('id')
    .where('owner', '=', coords.owner)
    .where('repo', '=', coords.name)
    .where((eb) =>
      eb.or([
        eb('githubInstallationId', '=', installation.id),
        eb('githubInstallationId', 'is', null),
      ]),
    )
    .executeTakeFirst()
  if (!repo) return

  const { durably } = await import('~/app/services/durably.server')
  await durably.jobs.crawl.trigger(
    {
      organizationId: orgId,
      refresh: false,
      repositoryId: repo.id,
      prNumbers: [prNumber],
    },
    {
      concurrencyKey: crawlConcurrencyKey(orgId),
      labels: { organizationId: orgId },
      coalesce: 'skip',
    },
  )
}
