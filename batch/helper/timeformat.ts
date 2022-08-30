import dayjs from 'dayjs'
export const timeFormat = (date: string | null) => (date ? dayjs(date).format('YYYY-MM-DD HH:mm:ss') : null)
