import dayjs from '~/app/libs/dayjs'

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
const log = async (type: string, ...args: any[]) => {
  console.log(`${dayjs().utc().format('YYYY-MM-DD HH:mm:ss.SSS')}`, type, ...args)
}
export const logger = {
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  info: async (...args: any[]): Promise<any> => await log('INFO', ...args),
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  warn: async (...args: any[]): Promise<any> => log('WARN', ...args),
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  debug: async (...args: any[]): Promise<any> => log('DEBUG', ...args),
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  error: async (...args: any[]): Promise<any> => log('ERROR', ...args),
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  fatal: async (...args: any[]): Promise<any> => log('FATAL', ...args),
}
