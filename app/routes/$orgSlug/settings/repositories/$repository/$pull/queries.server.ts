import { jsonObjectFrom } from 'kysely/helpers/sqlite'
import {
  getTenantDb,
  type OrganizationId,
} from '~/app/services/tenant-db.server'

export const getRepositoryWithIntegration = async (
  organizationId: OrganizationId,
  repositoryId: string,
) => {
  const tenantDb = getTenantDb(organizationId)
  return await tenantDb
    .selectFrom('repositories')
    .where('id', '=', repositoryId)
    .select((eb) => [
      'id',
      'owner',
      'repo',
      jsonObjectFrom(
        eb
          .selectFrom('integrations')
          .select(['privateToken'])
          .whereRef('integrations.id', '=', 'repositories.integrationId'),
      ).as('integration'),
    ])
    .executeTakeFirst()
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
    .select(['commits', 'reviews', 'discussions'])
    .where('repositoryId', '=', repositoryId)
    .where('pullRequestNumber', '=', pullRequestNumber)
    .executeTakeFirst()
  return row ?? null
}
