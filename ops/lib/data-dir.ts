import fs from 'node:fs'
import path from 'node:path'

export const DATA_DIR = 'data'
export const BACKUP_PREFIX = 'backup_'

export function isDbFile(filename: string): boolean {
  return (
    filename.endsWith('.db') ||
    filename.endsWith('.db-wal') ||
    filename.endsWith('.db-shm')
  )
}

/** Remove all .db / .db-wal / .db-shm files from DATA_DIR */
export function removeAllDbFiles(): number {
  const files = fs.readdirSync(DATA_DIR).filter(isDbFile)
  for (const file of files) {
    fs.unlinkSync(path.join(DATA_DIR, file))
  }
  return files.length
}
