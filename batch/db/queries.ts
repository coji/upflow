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

async function getAllGithubAppLinks() {
  const rows = await db
    .selectFrom('githubAppLinks')
    .select(githubAppLinkColumns)
    .where('deletedAt', 'is', null)
    .execute()
  return new Map(rows.map((r) => [r.organizationId, r]))
}

async function getAllIntegrations() {
  const rows = await db.selectFrom('integrations').selectAll().execute()
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
      const githubAppLink = appLinksMap.get(org.id) ?? null
      return { ...org, ...tenantData, integration, githubAppLink }
    }),
  )
}

export const getOrganization = async (organizationId: OrganizationId) => {
  const org = await db
    .selectFrom('organizations')
    .select(['id', 'name', 'slug', 'createdAt'])
    .where('id', '=', organizationId)
    .executeTakeFirstOrThrow()

  const row = await db
    .selectFrom('integrations')
    .leftJoin('githubAppLinks', (join) =>
      join
        .onRef(
          'githubAppLinks.organizationId',
          '=',
          'integrations.organizationId',
        )
        .on('githubAppLinks.deletedAt', 'is', null),
    )
    .select([
      'integrations.id',
      'integrations.organizationId',
      'integrations.method',
      'integrations.provider',
      'integrations.privateToken',
      'integrations.appSuspendedAt',
      'integrations.createdAt',
      'integrations.updatedAt',
      'githubAppLinks.installationId',
      'githubAppLinks.githubOrg',
      'githubAppLinks.githubAccountId',
      'githubAppLinks.appRepositorySelection',
    ])
    .where('integrations.organizationId', '=', organizationId)
    .executeTakeFirst()

  const integration = row
    ? {
        id: row.id,
        organizationId: row.organizationId,
        method: row.method,
        provider: row.provider,
        privateToken: row.privateToken,
        appSuspendedAt: row.appSuspendedAt,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }
    : null

  const githubAppLink =
    row?.installationId != null &&
    row.githubOrg != null &&
    row.githubAccountId != null &&
    row.appRepositorySelection != null
      ? {
          organizationId,
          installationId: row.installationId,
          githubOrg: row.githubOrg,
          githubAccountId: row.githubAccountId,
          appRepositorySelection: row.appRepositorySelection,
        }
      : null

  const [tenantData, botLogins] = await Promise.all([
    getTenantData(org.id as OrganizationId),
    getBotLogins(org.id as OrganizationId),
  ])

  return { ...org, ...tenantData, botLogins, integration, githubAppLink }
}
