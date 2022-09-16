import Graceful from '@ladjs/graceful'
import Bree from 'bree'
import path from 'node:path'
import { logger } from './helper/logger'

export const createJobSchedular = () => {
  const jobSchedular = new Bree({
    root: path.join(__dirname, 'jobs'),
    logger,
    jobs: [
      {
        name: 'crawl',
        cron: '30 */1 * * *',
        timezone: 'Asia/Tokyo'
      }
    ],
    defaultExtension: process.env.NODE_ENV === 'production' ? 'js' : 'ts'
  })

  const start = async () => {
    const graceful = new Graceful({ brees: [jobSchedular] })
    graceful.listen()

    await jobSchedular.start()
    logger.info('job schedular started.')
  }

  return {
    jobSchedular,
    start
  }
}
