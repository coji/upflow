import { db } from '~/app/services/db.server'
import { getTenantDb } from '~/app/services/tenant-db.server'

export const getPullRequestReport = async (organizationId: string) => {
  const tenantDb = getTenantDb(organizationId)
  return await tenantDb
    .selectFrom('pullRequests')
    .innerJoin('repositories', 'pullRequests.repositoryId', 'repositories.id')
    .orderBy('mergedAt', 'desc')
    .selectAll('pullRequests')
    .execute()
}

async function getTenantData(organizationId: string) {
  const tenantDb = getTenantDb(organizationId)
  const [organizationSetting, integration, repositories, exportSetting] =
    await Promise.all([
      tenantDb
        .selectFrom('organizationSettings')
        .select([
          'releaseDetectionMethod',
          'releaseDetectionKey',
          'isActive',
          'excludedUsers',
          'refreshRequestedAt',
        ])
        .executeTakeFirst(),
      tenantDb
        .selectFrom('integrations')
        .select(['id', 'method', 'provider', 'privateToken'])
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
    integration: integration ? { ...integration, organizationId } : null,
    repositories: repositories.map((r) => ({ ...r, organizationId })),
    exportSetting: exportSetting ? { ...exportSetting, organizationId } : null,
  }
}

export const listAllOrganizations = async () => {
  const orgs = await db
    .selectFrom('organizations')
    .select(['id', 'name', 'slug', 'createdAt'])
    .execute()

  return Promise.all(
    orgs.map(async (org) => {
      const tenantData = await getTenantData(org.id)
      return { ...org, ...tenantData }
    }),
  )
}

export const getOrganization = async (organizationId: string) => {
  const org = await db
    .selectFrom('organizations')
    .select(['id', 'name', 'slug', 'createdAt'])
    .where('id', '=', organizationId)
    .executeTakeFirstOrThrow()

  const tenantData = await getTenantData(org.id)
  return { ...org, ...tenantData }
}
