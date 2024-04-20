import { jsonArrayFrom, jsonObjectFrom } from 'kysely/helpers/sqlite'
import { db, type DB } from '~/app/services/db.server'

export const getPullRequestReport = async (companyId: DB.Company['id']) => {
  return await db
    .selectFrom('pullRequests')
    .innerJoin('repositories', 'pullRequests.repositoryId', 'repositories.id')
    .where('repositories.companyId', '==', companyId)
    .orderBy('mergedAt', 'desc')
    .selectAll('pullRequests')
    .execute()
}

export const listAllCompanies = async () => {
  return await db
    .selectFrom('companies')
    .select((eb) => [
      'id',
      'name',
      'isActive',
      'releaseDetectionKey',
      'releaseDetectionMethod',
      'updatedAt',
      'createdAt',
      jsonObjectFrom(
        eb
          .selectFrom('integrations')
          .select(['id', 'companyId', 'method', 'provider', 'privateToken'])
          .whereRef('integrations.companyId', '==', 'companies.id'),
      ).as('integration'),
      jsonArrayFrom(
        eb
          .selectFrom('repositories')
          .select([
            'id',
            'repo',
            'owner',
            'companyId',
            'integrationId',
            'provider',
            'releaseDetectionKey',
            'releaseDetectionMethod',
            'repositories.updatedAt',
            'repositories.createdAt',
          ])
          .whereRef('repositories.companyId', '==', 'companies.id'),
      ).as('repositories'),
      jsonObjectFrom(
        eb
          .selectFrom('exportSettings')
          .select([
            'id',
            'companyId',
            'sheetId',
            'clientEmail',
            'privateKey',
            'updatedAt',
            'createdAt',
          ])
          .whereRef('exportSettings.companyId', '==', 'companies.id'),
      ).as('exportSetting'),
    ])
    .execute()
}

export const getCompany = async (companyId: DB.Company['id']) => {
  return await db
    .selectFrom('companies')
    .select((eb) => [
      'id',
      'name',
      'isActive',
      'releaseDetectionKey',
      'releaseDetectionMethod',
      'updatedAt',
      'createdAt',
      jsonObjectFrom(
        eb
          .selectFrom('integrations')
          .select(['id', 'companyId', 'method', 'provider', 'privateToken'])
          .whereRef('integrations.companyId', '==', 'companies.id'),
      ).as('integration'),
      jsonArrayFrom(
        eb
          .selectFrom('repositories')
          .select([
            'id',
            'repo',
            'owner',
            'companyId',
            'integrationId',
            'provider',
            'releaseDetectionKey',
            'releaseDetectionMethod',
            'repositories.updatedAt',
            'repositories.createdAt',
          ])
          .whereRef('repositories.companyId', '==', 'companies.id'),
      ).as('repositories'),
      jsonObjectFrom(
        eb
          .selectFrom('exportSettings')
          .select([
            'id',
            'companyId',
            'sheetId',
            'clientEmail',
            'privateKey',
            'updatedAt',
            'createdAt',
          ])
          .whereRef('exportSettings.companyId', '==', 'companies.id'),
      ).as('exportSetting'),
    ])
    .where('id', '==', companyId)
    .executeTakeFirstOrThrow()
}
