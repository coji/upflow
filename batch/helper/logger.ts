import dayjs from '~/app/libs/dayjs'

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
const log = (type: string, ...args: any[]) => {
  console.log(
    `${dayjs().utc().format('YYYY-MM-DD HH:mm:ss.SSS')}`,
    type,
    ...args,
  )
}
export const logger = {
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  info: async (...args: any[]) => log('INFO', ...args),
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  warn: async (...args: any[]) => log('WARN', ...args),
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  debug: async (...args: any[]) => log('DEBUG', ...args),
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  error: async (...args: any[]) => log('ERROR', ...args),
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  fatal: async (...args: any[]) => log('FATAL', ...args),
}
