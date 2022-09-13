import { parentPort } from 'node:worker_threads'
import { prisma } from '~/app/db.server'
import { createProvider } from '../provider'
import { logger } from '../helper/logger'
import { exportToSpreadsheet } from '../export'

const options = { refresh: false, halt: false }
if (parentPort) {
  parentPort.once('message', (message) => {
    if (message === 'cancel') {
      logger.fatal('cancel message received')
      options.halt = true
    }
  })
}

const crawlMain = async () => {
  logger.info('crawl started.')

  const companies = await prisma.company.findMany({
    include: { integration: true, repositories: true }
  })

  if (companies.length === 0) {
    logger.error('no company found')
    return
  }

  for (const company of companies) {
    logger.info('company: ', company)

    const integration = company.integration
    if (!integration) {
      logger.error('integration not set:', company.id, company.name)
      continue
    }

    const provider = createProvider(integration)
    if (!provider) {
      logger.error('provider cant detected', company.id, company.name, integration.provider)
      continue
    }

    for (const repository of company.repositories) {
      if (!provider) {
        continue
      }
      logger.info('fetch started...')
      await provider.fetch(repository, options)
      logger.info('fetch completed.')
    }

    logger.info('upsert started...')
    await provider.upsert(company, company.repositories)
    logger.info('upsert completed.')

    // google spreadsheet にエクスポート
    logger.info('exporting to spreadsheet...')
    await exportToSpreadsheet(company)
    logger.info('export to spreadsheet done')
  }

  logger.info('crawl completed.')
}

crawlMain()
