import Graceful from '@ladjs/graceful'
import Bree from 'bree'
import path from 'node:path'
import { logger } from './helper/logger'

export const startBatchJobSchedular = async () => {
  const bree = new Bree({
    root: path.join(__dirname, 'jobs'),
    logger,
    jobs: [
      {
        name: 'crawl',
        cron: '* 3 * * *',
        timezone: 'Asia/Tokyo'
      }
    ],
    defaultExtension: process.env.NODE_ENV === 'production' ? 'js' : 'ts'
  })

  const graceful = new Graceful({ brees: [bree] })
  graceful.listen()

  await bree.start()
  logger.info('batch process started.')
}
console.log(process.cwd())
