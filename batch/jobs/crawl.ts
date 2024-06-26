import { listAllCompanies, upsertPullRequest } from '~/batch/db'
import {
  exportPullsToSpreadsheet,
  exportReviewResponsesToSpreadsheet,
} from '../bizlogic/export-spreadsheet'
import { logger } from '../helper/logger'
import { createProvider } from '../provider'

const options = { refresh: false, halt: false, delay: 1000 }

export const crawlJob = async () => {
  logger.info('crawl started.')

  const companies = await listAllCompanies()

  for (const company of companies) {
    logger.info('company: ', company.name)

    if (!company.isActive) {
      logger.info('company is not active.')
      continue
    }

    const integration = company.integration
    if (!integration) {
      logger.error('integration not set:', company.id, company.name)
      continue
    }

    const provider = createProvider(integration)
    if (!provider) {
      logger.error(
        'provider cant detected',
        company.id,
        company.name,
        integration.provider,
      )
      continue
    }

    // fetch
    for (const repository of company.repositories) {
      logger.info('fetch started...')
      await provider.fetch(repository, options)
      logger.info('fetch completed.')
    }

    // analyze
    logger.info('analyze started...')
    const { pulls, reviewResponses } = await provider.analyze(
      company,
      company.repositories,
    )
    logger.info('analyze completed.')

    // upsert
    logger.info('upsert started...')
    for (const pr of pulls) {
      await upsertPullRequest(pr)
    }
    logger.info('upsert completed.')

    // export
    if (company.exportSetting) {
      logger.info('exporting to spreadsheet...')
      await exportPullsToSpreadsheet(pulls, company.exportSetting)
      await exportReviewResponsesToSpreadsheet(
        reviewResponses,
        company.exportSetting,
      )
      logger.info('export to spreadsheet done')
    }
  }

  logger.info('crawl completed.')
}
