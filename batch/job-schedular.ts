import schedule from 'node-schedule'
import { logger } from './helper/logger'
import { crawlJob } from './jobs/crawl'

export const createJobSchedular = () => {
  const start = () => {
    let isRunning = false

    schedule.scheduleJob('30 * * * *', async () => {
      try {
        if (isRunning) throw new Error('crawl job already running.')
        isRunning = true
        await logger.info('crawl job started.')

        await crawlJob()

        isRunning = false
        await logger.info('crawl job completed.')
      } catch (e) {
        isRunning = false
        await logger.error(e)
      }
    })
  }

  return { start }
}
