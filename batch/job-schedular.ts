import schedule from 'node-schedule'
import { logger } from './helper/logger'
import { crawlJob } from './jobs/crawl'

export const createJobSchedular = () => {
  const startSchedular = () => {
    console.log('job schedular started.')
    let isRunning = false

    schedule.scheduleJob('30 * * * *', async () => {
      try {
        if (isRunning) throw new Error('crawl job already running.')
        isRunning = true
        logger.info('crawl job started.')

        await crawlJob()

        isRunning = false
        logger.info('crawl job completed.')
      } catch (e) {
        isRunning = false
        logger.error(e)
      }
    })
  }

  return { startSchedular }
}
