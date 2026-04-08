import { db } from '~/app/services/db.server'
import { getTenantDb } from '~/app/services/tenant-db.server'
import type { OrganizationId } from '~/app/types/organization'

export const getPullRequestReport = async (organizationId: OrganizationId) => {
  const tenantDb = getTenantDb(organizationId)
  return await tenantDb
    .selectFrom('pullRequests')
    .innerJoin('repositories', 'pullRequests.repositoryId', 'repositories.id')
    .orderBy('mergedAt', 'desc')
    .select([
      'pullRequests.repo',
      'pullRequests.number',
      'pullRequests.sourceBranch',
      'pullRequests.targetBranch',
      'pullRequests.state',
      'pullRequests.author',
      'pullRequests.title',
      'pullRequests.url',
      'pullRequests.codingTime',
      'pullRequests.pickupTime',
      'pullRequests.reviewTime',
      'pullRequests.deployTime',
      'pullRequests.totalTime',
      'pullRequests.firstCommittedAt',
      'pullRequests.pullRequestCreatedAt',
      'pullRequests.firstReviewedAt',
      'pullRequests.mergedAt',
      'pullRequests.releasedAt',
      'pullRequests.updatedAt',
    ])
    .execute()
}

const githubAppLinkColumns = [
  'organizationId',
  'installationId',
  'githubOrg',
  'githubAccountId',
  'githubAccountType',
  'appRepositorySelection',
  'suspendedAt',
  'membershipInitializedAt',
] as const

async function getGithubAppLinksByOrgId(organizationId: OrganizationId) {
  return await db
    .selectFrom('githubAppLinks')
    .select(githubAppLinkColumns)
    .where('organizationId', '=', organizationId)
    .where('deletedAt', 'is', null)
    .execute()
}

async function getAllGithubAppLinks() {
  const rows = await db
    .selectFrom('githubAppLinks')
    .select(githubAppLinkColumns)
    .where('deletedAt', 'is', null)
    .execute()
  return Map.groupBy(rows, (r) => r.organizationId)
}

const integrationColumns = [
  'id',
  'organizationId',
  'method',
  'provider',
  'privateToken',
] as const

async function getIntegrationByOrgId(organizationId: OrganizationId) {
  return (
    (await db
      .selectFrom('integrations')
      .select(integrationColumns)
      .where('organizationId', '=', organizationId)
      .executeTakeFirst()) ?? null
  )
}

async function getAllIntegrations() {
  const rows = await db
    .selectFrom('integrations')
    .select(integrationColumns)
    .execute()
  return new Map(rows.map((r) => [r.organizationId, r]))
}

async function getTenantData(organizationId: OrganizationId) {
  const tenantDb = getTenantDb(organizationId)
  const [organizationSetting, repositories, exportSetting] = await Promise.all([
    tenantDb
      .selectFrom('organizationSettings')
      .select(['releaseDetectionMethod', 'releaseDetectionKey', 'isActive'])
      .executeTakeFirst(),
    tenantDb
      .selectFrom('repositories')
      .select([
        'id',
        'repo',
        'owner',
        'integrationId',
        'provider',
        'releaseDetectionKey',
        'releaseDetectionMethod',
        'teamId',
        'updatedAt',
        'createdAt',
        'scanWatermark',
        'githubInstallationId',
      ])
      .execute(),
    tenantDb
      .selectFrom('exportSettings')
      .select([
        'id',
        'sheetId',
        'clientEmail',
        'privateKey',
        'updatedAt',
        'createdAt',
      ])
      .executeTakeFirst(),
  ])
  return {
    organizationSetting: organizationSetting ?? null,
    repositories,
    exportSetting: exportSetting ?? null,
  }
}

export async function getBotLogins(
  organizationId: OrganizationId,
): Promise<string[]> {
  const tenantDb = getTenantDb(organizationId)
  const rows = await tenantDb
    .selectFrom('companyGithubUsers')
    .select('login')
    .where('type', '=', 'Bot')
    .execute()
  return rows.map((r) => r.login.toLowerCase())
}

export const listAllOrganizations = async () => {
  const [orgs, appLinksMap, integrationsMap] = await Promise.all([
    db
      .selectFrom('organizations')
      .select(['id', 'name', 'slug', 'createdAt'])
      .execute(),
    getAllGithubAppLinks(),
    getAllIntegrations(),
  ])

  return Promise.all(
    orgs.map(async (org) => {
      const tenantData = await getTenantData(org.id as OrganizationId)
      const integration = integrationsMap.get(org.id) ?? null
      const githubAppLinks = appLinksMap.get(org.id) ?? []
      return { ...org, ...tenantData, integration, githubAppLinks }
    }),
  )
}

export const getOrganization = async (organizationId: OrganizationId) => {
  const org = await db
    .selectFrom('organizations')
    .select(['id', 'name', 'slug', 'createdAt'])
    .where('id', '=', organizationId)
    .executeTakeFirstOrThrow()

  const [integration, githubAppLinks, tenantData, botLogins] =
    await Promise.all([
      getIntegrationByOrgId(organizationId),
      getGithubAppLinksByOrgId(organizationId),
      getTenantData(organizationId),
      getBotLogins(organizationId),
    ])

  return { ...org, ...tenantData, botLogins, integration, githubAppLinks }
}
