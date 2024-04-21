import dayjs from '~/app/libs/dayjs'

export function timeFormatUTC<T extends string | null | undefined>(
  date: T,
): T extends string ? string : null {
  if (date === null || date === undefined) {
    return null as T extends string ? string : null
  }
  return dayjs(date)
    .utc(false)
    .format('YYYY-MM-DD HH:mm:ss') as T extends string ? string : null
}

export function timeFormatTz<T extends string | null | undefined>(
  date: T,
  tz: string,
): T extends string ? string : null {
  if (date === null || date === undefined) {
    return null as T extends string ? string : null
  }
  return dayjs(date).tz(tz).format('YYYY-MM-DD HH:mm:ss') as T extends string
    ? string
    : null
}
