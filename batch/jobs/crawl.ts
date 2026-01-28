import { listAllOrganizations } from '~/batch/db'
import { logger } from '../helper/logger'
import { createProvider } from '../provider'
import { analyzeAndUpsert } from '../usecases/analyze-and-upsert'

const options = { refresh: false, halt: false }

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

    // fetch
    for (const repository of organization.repositories) {
      logger.info('fetch started...')
      await provider.fetch(repository, options)
      logger.info('fetch completed.')
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
