import { clearAllCache } from '~/app/services/cache.server'
import { getTenantDb } from '~/app/services/tenant-db.server'
import type { OrganizationId } from '~/app/types/organization'
import { listAllOrganizations } from '~/batch/db'
import { fetchRepo } from '~/batch/github/fetch-repo'
import { logger } from '../helper/logger'
import { analyzeAndUpsert } from '../usecases/analyze-and-upsert'

export const crawlJob = async () => {
  logger.info('crawl started.')

  try {
    const organizations = await listAllOrganizations()

    for (const organization of organizations) {
      logger.info('organization:', organization.name)

      if (!organization.organizationSetting?.isActive) {
        logger.info('organization is not active.')
        continue
      }

      const integration = organization.integration
      if (!integration) {
        logger.error('integration not set:', organization.id, organization.name)
        continue
      }

      const orgId = organization.id as OrganizationId

      // refreshRequestedAt が設定されていれば full refresh
      const refresh =
        organization.organizationSetting.refreshRequestedAt != null
      if (refresh) {
        logger.info('refresh requested, using full refresh.')
      }
      const options = { refresh, halt: false }

      // fetch
      for (const repository of organization.repositories) {
        logger.info('fetch started...')
        await fetchRepo(orgId, repository, integration, options)
        logger.info('fetch completed.')
      }

      // refresh フラグを消費
      if (refresh) {
        const tenantDb = getTenantDb(orgId)
        await tenantDb
          .updateTable('organizationSettings')
          .set({ refreshRequestedAt: null })
          .execute()
        logger.info('refresh flag consumed.')
      }

      // analyze + upsert + export
      await analyzeAndUpsert({
        organization: {
          id: orgId,
          organizationSetting: organization.organizationSetting,
          repositories: organization.repositories,
          exportSetting: organization.exportSetting,
        },
      })
    }

    logger.info('crawl completed.')
  } finally {
    clearAllCache()
  }
}
