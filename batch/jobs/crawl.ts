import { db } from '~/app/services/db.server'
import { listAllOrganizations } from '~/batch/db'
import { logger } from '../helper/logger'
import { createProvider } from '../provider'
import { analyzeAndUpsert } from '../usecases/analyze-and-upsert'

export const crawlJob = async () => {
  logger.info('crawl started.')

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

    const provider = createProvider(integration)
    if (!provider) {
      logger.error(
        'provider cant detected',
        organization.id,
        organization.name,
        integration.provider,
      )
      continue
    }

    // refreshRequestedAt が設定されていれば full refresh
    const refresh = organization.organizationSetting.refreshRequestedAt != null
    if (refresh) {
      logger.info('refresh requested, using full refresh.')
    }
    const options = { refresh, halt: false }

    // fetch
    for (const repository of organization.repositories) {
      logger.info('fetch started...')
      await provider.fetch(repository, options)
      logger.info('fetch completed.')
    }

    // refresh フラグを消費
    if (refresh) {
      await db
        .updateTable('organizationSettings')
        .set({ refreshRequestedAt: null })
        .where('organizationId', '=', organization.id)
        .execute()
      logger.info('refresh flag consumed.')
    }

    // analyze + upsert + export
    await analyzeAndUpsert({
      organization: {
        ...organization,
        organizationSetting: organization.organizationSetting,
      },
      provider,
    })
  }

  logger.info('crawl completed.')
}
