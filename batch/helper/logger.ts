import dayjs from 'dayjs'

const log = (type: string, ...args: any[]) => {
  console.log(`${dayjs().format('YYYY-MM-DD HH:mm:ss.SSS')}`, type, ...args)
}
export const logger = {
  info: (...args: any[]): any => log('INFO', ...args),
  warn: (...args: any[]): any => log('WARN', ...args),
  debug: (...args: any[]): any => log('DEBUG', ...args),
  error: (...args: any[]): any => log('ERROR', ...args),
  fatal: (...args: any[]): any => log('FATAL', ...args)
}
