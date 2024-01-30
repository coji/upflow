import { upsertPullRequest } from '~/app/models/pullRequest.server'
import { prisma } from '~/app/services/db.server'
import {
  exportPullsToSpreadsheet,
  exportReviewResponsesToSpreadsheet,
} from '../bizlogic/export-spreadsheet'
import { logger } from '../helper/logger'
import { createProvider } from '../provider'

const options = { refresh: false, halt: false, delay: 800 }

export const crawlJob = async () => {
  await logger.info('crawl started.')

  const companies = await prisma.company.findMany({
    include: { integration: true, repositories: true, exportSetting: true },
  })

  for (const company of companies) {
    await logger.info('company: ', company.name)

    if (!company.isActive) {
      await logger.info('company is not active.')
      continue
    }

    const integration = company.integration
    if (!integration) {
      await logger.error('integration not set:', company.id, company.name)
      continue
    }

    const provider = createProvider(integration)
    if (!provider) {
      await logger.error(
        'provider cant detected',
        company.id,
        company.name,
        integration.provider,
      )
      continue
    }

    // fetch
    for (const repository of company.repositories) {
      await logger.info('fetch started...')
      await provider.fetch(repository, options)
      await logger.info('fetch completed.')
    }

    // analyze
    await logger.info('analyze started...')
    const { pulls, reviewResponses } = await provider.analyze(
      company,
      company.repositories,
    )
    await logger.info('analyze completed.')

    // upsert
    await logger.info('upsert started...')
    for (const pr of pulls) {
      await upsertPullRequest(pr)
    }
    await logger.info('upsert completed.')

    // export
    if (company.exportSetting) {
      await logger.info('exporting to spreadsheet...')
      await exportPullsToSpreadsheet(pulls, company.exportSetting)
      await exportReviewResponsesToSpreadsheet(
        reviewResponses,
        company.exportSetting,
      )
      await logger.info('export to spreadsheet done')
    }
  }

  await logger.info('crawl completed.')
}
