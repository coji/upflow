import dayjs from '~/app/libs/dayjs'
export const timeFormat = (date: string | null, tz: string | undefined = 'UTC') =>
  date ? dayjs(date).tz(tz).format('YYYY-MM-DD HH:mm:ss') : null
