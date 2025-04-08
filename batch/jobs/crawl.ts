import { listAllOrganizations, upsertPullRequest } from '~/batch/db'
import {
  exportPullsToSpreadsheet,
  exportReviewResponsesToSpreadsheet,
} from '../bizlogic/export-spreadsheet'
import { logger } from '../helper/logger'
import { createProvider } from '../provider'

const options = { refresh: false, halt: false, delay: 1000 }

export const crawlJob = async () => {
  logger.info('crawl started.')

  const organizations = await listAllOrganizations()

  for (const organization of organizations) {
    logger.info('organization: ', organization.name)

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

    // analyze
    logger.info('analyze started...')
    const { pulls, reviewResponses } = await provider.analyze(
      organization.organizationSetting,
      organization.repositories,
    )
    logger.info('analyze completed.')

    // upsert
    logger.info('upsert started...')
    for (const pr of pulls) {
      await upsertPullRequest(pr)
    }
    logger.info('upsert completed.')

    // export
    if (organization.exportSetting) {
      logger.info('exporting to spreadsheet...')
      await exportPullsToSpreadsheet(pulls, organization.exportSetting)
      await exportReviewResponsesToSpreadsheet(
        reviewResponses,
        organization.exportSetting,
      )
      logger.info('export to spreadsheet done')
    }
  }

  logger.info('crawl completed.')
}
