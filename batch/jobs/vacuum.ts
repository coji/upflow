import { prisma } from '~/app/utils/db.server'
import { logger } from '../helper/logger'
import dayjs from '~/app/libs/dayjs'

export const vacuumJob = async () => {
  const deleted = await prisma.batchLog.deleteMany({
    where: {
      createdAt: {
        lt: dayjs().subtract(3, 'days').toDate()
      }
    }
  })
  await logger.info('deleted batchLog:', deleted.count)
}
