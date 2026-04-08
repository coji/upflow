import createDebug from 'debug'
import { db } from '~/app/services/db.server'
import {
  findActiveLinkByInstallation,
  isRecord,
  readInstallation,
} from '~/app/services/github-webhook-shared.server'
import { crawlConcurrencyKey } from '~/app/services/jobs/concurrency-keys.server'
import { getTenantDb } from '~/app/services/tenant-db.server'
import type { OrganizationId } from '~/app/types/organization'

const debug = createDebug('app:github-webhook:pull')

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
  event: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const installation = readInstallation(payload)
  if (!installation) {
    debug('%s: payload has no installation, dropped', event)
    return
  }

  const link = await findActiveLinkByInstallation(db, installation.id)
  if (!link) {
    debug(
      '%s: no active github_app_links row for installation_id=%s, dropped',
      event,
      installation.id,
    )
    return
  }

  const orgId = link.organizationId as OrganizationId

  const coords = readRepositoryOwnerName(payload)
  if (!coords) {
    debug('%s: payload has no repository owner/name, dropped', event)
    return
  }

  const prNumber = extractPullRequestNumber(payload)
  if (prNumber === null) {
    debug('%s: payload has no pull_request.number, dropped', event)
    return
  }

  const tenantDb = getTenantDb(orgId)
  // Strict lookup: the repository must belong to the installation that
  // delivered the webhook. Repositories with `github_installation_id IS NULL`
  // (broken state) require the operator to run reassign-broken-repositories
  // first; until then their webhooks fall through this guard.
  const repo = await tenantDb
    .selectFrom('repositories')
    .select('id')
    .where('owner', '=', coords.owner)
    .where('repo', '=', coords.name)
    .where('githubInstallationId', '=', installation.id)
    .executeTakeFirst()
  if (!repo) {
    debug(
      '%s: no tenant repository for org=%s installation=%s %s/%s, dropped (run reassign-broken-repositories?)',
      event,
      orgId,
      installation.id,
      coords.owner,
      coords.name,
    )
    return
  }

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
