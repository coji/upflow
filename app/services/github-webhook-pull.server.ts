import { db } from '~/app/services/db.server'
import {
  isRecord,
  readInstallation,
} from '~/app/services/github-webhook-shared.server'
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

  const link = await db
    .selectFrom('githubAppLinks')
    .select('organizationId')
    .where('installationId', '=', installation.id)
    .where('deletedAt', 'is', null)
    .executeTakeFirst()
  if (!link) return

  const orgId = link.organizationId as OrganizationId

  const coords = readRepositoryOwnerName(payload)
  if (!coords) return

  const prNumber = extractPullRequestNumber(payload)
  if (prNumber === null) return

  const tenantDb = getTenantDb(orgId)
  const repo = await tenantDb
    .selectFrom('repositories')
    .select('id')
    .where('owner', '=', coords.owner)
    .where('repo', '=', coords.name)
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
      concurrencyKey: `crawl:${orgId}`,
      labels: { organizationId: orgId },
      coalesce: 'skip',
    },
  )
}
