import { db } from '~/app/services/db.server'
import { getTenantDb } from '~/app/services/tenant-db.server'
import type { OrganizationId } from '~/app/types/organization'

export const getPullRequestReport = async (organizationId: OrganizationId) => {
  const tenantDb = getTenantDb(organizationId)
  return await tenantDb
    .selectFrom('pullRequests')
    .innerJoin('repositories', 'pullRequests.repositoryId', 'repositories.id')
    .orderBy('mergedAt', 'desc')
    .selectAll('pullRequests')
    .execute()
}

const githubAppLinkColumns = [
  'organizationId',
  'installationId',
  'githubOrg',
  'githubAccountId',
  'appRepositorySelection',
] as const

async function getGithubAppLink(organizationId: OrganizationId) {
  return (
    (await db
      .selectFrom('githubAppLinks')
      .select(githubAppLinkColumns)
      .where('organizationId', '=', organizationId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst()) ?? null
  )
}

async function getAllGithubAppLinks() {
  const rows = await db
    .selectFrom('githubAppLinks')
    .select(githubAppLinkColumns)
    .where('deletedAt', 'is', null)
    .execute()
  return new Map(rows.map((r) => [r.organizationId, r]))
}

async function getTenantData(organizationId: OrganizationId) {
  const tenantDb = getTenantDb(organizationId)
  const [organizationSetting, integration, repositories, exportSetting] =
    await Promise.all([
      tenantDb
        .selectFrom('organizationSettings')
        .select(['releaseDetectionMethod', 'releaseDetectionKey', 'isActive'])
        .executeTakeFirst(),
      tenantDb
        .selectFrom('integrations')
        .select(['id', 'method', 'provider', 'privateToken', 'appSuspendedAt'])
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
    integration: integration ?? null,
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
  const [orgs, appLinksMap] = await Promise.all([
    db
      .selectFrom('organizations')
      .select(['id', 'name', 'slug', 'createdAt'])
      .execute(),
    getAllGithubAppLinks(),
  ])

  return Promise.all(
    orgs.map(async (org) => {
      const tenantData = await getTenantData(org.id as OrganizationId)
      const githubAppLink = appLinksMap.get(org.id) ?? null
      return { ...org, ...tenantData, githubAppLink }
    }),
  )
}

export const getOrganization = async (organizationId: OrganizationId) => {
  const org = await db
    .selectFrom('organizations')
    .select(['id', 'name', 'slug', 'createdAt'])
    .where('id', '=', organizationId)
    .executeTakeFirstOrThrow()

  const [tenantData, botLogins, githubAppLink] = await Promise.all([
    getTenantData(org.id as OrganizationId),
    getBotLogins(org.id as OrganizationId),
    getGithubAppLink(org.id as OrganizationId),
  ])
  return { ...org, ...tenantData, botLogins, githubAppLink }
}
