import { jsonArrayFrom, jsonObjectFrom } from 'kysely/helpers/sqlite'
import { db, type DB } from '~/app/services/db.server'

export const getPullRequestReport = async (
  organizationId: DB.Organization['id'],
) => {
  return await db
    .selectFrom('pullRequests')
    .innerJoin('repositories', 'pullRequests.repositoryId', 'repositories.id')
    .where('repositories.organizationId', '=', organizationId)
    .orderBy('mergedAt', 'desc')
    .selectAll('pullRequests')
    .execute()
}

export const listAllOrganizations = async () => {
  return await db
    .selectFrom('organizations')
    .select((eb) => [
      'id',
      'name',
      'slug',
      'createdAt',
      jsonObjectFrom(
        eb
          .selectFrom('organizationSettings')
          .selectAll()
          .whereRef(
            'organizationSettings.organizationId',
            '==',
            'organizations.id',
          ),
      ).as('organizationSetting'),
      jsonObjectFrom(
        eb
          .selectFrom('integrations')
          .select([
            'id',
            'organizationId',
            'method',
            'provider',
            'privateToken',
          ])
          .whereRef('integrations.organizationId', '==', 'organizations.id'),
      ).as('integration'),
      jsonArrayFrom(
        eb
          .selectFrom('repositories')
          .select([
            'id',
            'repo',
            'owner',
            'organizationId',
            'integrationId',
            'provider',
            'releaseDetectionKey',
            'releaseDetectionMethod',
            'updatedAt',
            'createdAt',
          ])
          .whereRef('repositories.organizationId', '=', 'organizations.id'),
      ).as('repositories'),
      jsonObjectFrom(
        eb
          .selectFrom('exportSettings')
          .select([
            'id',
            'organizationId',
            'sheetId',
            'clientEmail',
            'privateKey',
            'updatedAt',
            'createdAt',
          ])
          .whereRef('exportSettings.organizationId', '=', 'organizations.id'),
      ).as('exportSetting'),
    ])
    .execute()
}

export const getOrganization = async (
  organizationId: DB.Organization['id'],
) => {
  return await db
    .selectFrom('organizations')
    .select((eb) => [
      'id',
      'name',
      'slug',
      'createdAt',
      jsonObjectFrom(
        eb
          .selectFrom('organizationSettings')
          .selectAll()
          .whereRef(
            'organizationSettings.organizationId',
            '==',
            'organizations.id',
          ),
      ).as('organizationSetting'),
      jsonObjectFrom(
        eb
          .selectFrom('integrations')
          .select([
            'id',
            'organizationId',
            'method',
            'provider',
            'privateToken',
          ])
          .whereRef('integrations.organizationId', '=', 'organizations.id'),
      ).as('integration'),
      jsonArrayFrom(
        eb
          .selectFrom('repositories')
          .select([
            'id',
            'repo',
            'owner',
            'organizationId',
            'integrationId',
            'provider',
            'releaseDetectionKey',
            'releaseDetectionMethod',
            'repositories.updatedAt',
            'repositories.createdAt',
          ])
          .whereRef('repositories.organizationId', '=', 'organizations.id'),
      ).as('repositories'),
      jsonObjectFrom(
        eb
          .selectFrom('exportSettings')
          .select([
            'id',
            'organizationId',
            'sheetId',
            'clientEmail',
            'privateKey',
            'updatedAt',
            'createdAt',
          ])
          .whereRef('exportSettings.organizationId', '=', 'organizations.id'),
      ).as('exportSetting'),
    ])
    .where('id', '=', organizationId)
    .executeTakeFirstOrThrow()
}
