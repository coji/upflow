import { prisma } from '~/app/utils/db.server'
import dayjs from '~/app/libs/dayjs'

const log = async (type: string, ...args: any[]) => {
  await prisma.batchLog.create({
    data: {
      type,
      message: args.join(' ')
    }
  })
  console.log(`${dayjs().utc().format('YYYY-MM-DD HH:mm:ss.SSS')}`, type, ...args)
}
export const logger = {
  info: async (...args: any[]): Promise<any> => await log('INFO', ...args),
  warn: async (...args: any[]): Promise<any> => log('WARN', ...args),
  debug: async (...args: any[]): Promise<any> => log('DEBUG', ...args),
  error: async (...args: any[]): Promise<any> => log('ERROR', ...args),
  fatal: async (...args: any[]): Promise<any> => log('FATAL', ...args)
}
