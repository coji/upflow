import Graceful from '@ladjs/graceful'
import Bree from 'bree'
import path from 'node:path'

export const main = async () => {
  const bree = new Bree({
    root: path.join(__dirname, 'jobs'),
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
  console.log('batch process started.')
}

main()
