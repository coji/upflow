export const DATA_DIR = 'data'
export const BACKUP_PREFIX = 'backup_'

export function isDbFile(filename: string): boolean {
  return (
    filename.endsWith('.db') ||
    filename.endsWith('.db-wal') ||
    filename.endsWith('.db-shm')
  )
}
