import consola from 'consola'
import schedule from 'node-schedule'
import { logger } from './helper/logger'
import { crawlJob } from './jobs/crawl'

export const createJobScheduler = () => {
  const startScheduler = () => {
    consola.info('job scheduler started.')
    let isRunning = false

    schedule.scheduleJob('30 * * * *', async () => {
      if (isRunning) {
        logger.warn('crawl job already running, skipping.')
        return
      }
      isRunning = true
      try {
        logger.info('crawl job started.')
        await crawlJob()
        logger.info('crawl job completed.')
      } catch (e) {
        logger.error(e)
      } finally {
        isRunning = false
      }
    })
  }

  return { startScheduler }
}
