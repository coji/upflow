import { db } from '~/app/services/db.server'
import type { OrganizationId } from '~/app/types/organization'

export const getIntegration = async (organizationId: OrganizationId) => {
  return await db
    .selectFrom('integrations')
    .selectAll()
    .where('organizationId', '=', organizationId)
    .executeTakeFirst()
}

export const getGithubAppLink = async (organizationId: OrganizationId) => {
  return (
    (await db
      .selectFrom('githubAppLinks')
      .select(['githubOrg', 'appRepositorySelection', 'installationId'])
      .where('organizationId', '=', organizationId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst()) ?? null
  )
}
