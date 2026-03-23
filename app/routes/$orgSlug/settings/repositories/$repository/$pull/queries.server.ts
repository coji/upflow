import { db } from '~/app/services/db.server'
import { getTenantDb } from '~/app/services/tenant-db.server'
import type { OrganizationId } from '~/app/types/organization'

export const getRepositoryWithIntegration = async (
  organizationId: OrganizationId,
  repositoryId: string,
) => {
  const tenantDb = getTenantDb(organizationId)
  const repo = await tenantDb
    .selectFrom('repositories')
    .where('id', '=', repositoryId)
    .select(['id', 'owner', 'repo', 'integrationId'])
    .executeTakeFirst()
  if (!repo) return undefined

  const integration = await db
    .selectFrom('integrations')
    .select(['privateToken'])
    .where('id', '=', repo.integrationId)
    .where('organizationId', '=', organizationId)
    .executeTakeFirst()

  return {
    id: repo.id,
    owner: repo.owner,
    repo: repo.repo,
    integration: integration ?? null,
  }
}

export const getPullRequest = async (
  organizationId: OrganizationId,
  repositoryId: string,
  number: number,
) => {
  const tenantDb = getTenantDb(organizationId)
  return await tenantDb
    .selectFrom('pullRequests')
    .where('repositoryId', '=', repositoryId)
    .where('number', '=', number)
    .selectAll()
    .executeTakeFirst()
}

export const getPullRequestRawData = async (
  organizationId: OrganizationId,
  repositoryId: string,
  pullRequestNumber: number,
) => {
  const tenantDb = getTenantDb(organizationId)
  const row = await tenantDb
    .selectFrom('githubRawData')
    .select(['commits', 'reviews', 'discussions', 'timelineItems'])
    .where('repositoryId', '=', repositoryId)
    .where('pullRequestNumber', '=', pullRequestNumber)
    .executeTakeFirst()
  return row ?? null
}

export const getOrganizationSettings = async (
  organizationId: OrganizationId,
) => {
  const tenantDb = getTenantDb(organizationId)
  return await tenantDb
    .selectFrom('organizationSettings')
    .select(['releaseDetectionMethod', 'releaseDetectionKey'])
    .executeTakeFirst()
}

export const getShapedPullRequest = async (
  organizationId: OrganizationId,
  repositoryId: string,
  pullRequestNumber: number,
) => {
  const tenantDb = getTenantDb(organizationId)
  const row = await tenantDb
    .selectFrom('githubRawData')
    .select('pullRequest')
    .where('repositoryId', '=', repositoryId)
    .where('pullRequestNumber', '=', pullRequestNumber)
    .executeTakeFirst()
  return row?.pullRequest ?? null
}

export const getPullRequestReviews = async (
  organizationId: OrganizationId,
  repositoryId: string,
  pullRequestNumber: number,
) => {
  const tenantDb = getTenantDb(organizationId)
  return await tenantDb
    .selectFrom('pullRequestReviews')
    .where('repositoryId', '=', repositoryId)
    .where('pullRequestNumber', '=', pullRequestNumber)
    .selectAll()
    .execute()
}

export const getPullRequestReviewers = async (
  organizationId: OrganizationId,
  repositoryId: string,
  pullRequestNumber: number,
) => {
  const tenantDb = getTenantDb(organizationId)
  return await tenantDb
    .selectFrom('pullRequestReviewers')
    .where('repositoryId', '=', repositoryId)
    .where('pullRequestNumber', '=', pullRequestNumber)
    .selectAll()
    .execute()
}
