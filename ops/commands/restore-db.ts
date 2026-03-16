import consola from 'consola'
import fs from 'node:fs'
import path from 'node:path'

const DATA_DIR = 'data'

interface RestoreDbOptions {
  name?: string
}

function listBackups(): string[] {
  if (!fs.existsSync(DATA_DIR)) return []
  return fs
    .readdirSync(DATA_DIR)
    .filter(
      (f) =>
        f.startsWith('backup_') &&
        fs.statSync(path.join(DATA_DIR, f)).isDirectory(),
    )
    .sort()
    .reverse()
}

export function restoreDbCommand(options: RestoreDbOptions) {
  const backups = listBackups()
  if (backups.length === 0) {
    consola.error('No backups found in data/')
    process.exit(1)
  }

  const target = options.name

  if (!target) {
    consola.info('Available backups (newest first):')
    for (const b of backups) {
      const files = fs
        .readdirSync(path.join(DATA_DIR, b))
        .filter((f) => f.endsWith('.db'))
      consola.log(`  ${b}  (${files.length} database(s))`)
    }
    consola.info('\nUsage: pnpm ops restore-db --name <backup_name>')
    return
  }

  const backupDir = path.join(DATA_DIR, target)
  if (!fs.existsSync(backupDir) || !fs.statSync(backupDir).isDirectory()) {
    consola.error(`Backup not found: ${target}`)
    consola.info('Run without --name to list available backups')
    process.exit(1)
  }

  const filesToRestore = fs
    .readdirSync(backupDir)
    .filter(
      (f) =>
        f.endsWith('.db') || f.endsWith('.db-wal') || f.endsWith('.db-shm'),
    )

  if (filesToRestore.length === 0) {
    consola.error(`No database files in backup: ${target}`)
    process.exit(1)
  }

  // Remove current db files
  const currentDbFiles = fs
    .readdirSync(DATA_DIR)
    .filter(
      (f) =>
        (f.endsWith('.db') || f.endsWith('.db-wal') || f.endsWith('.db-shm')) &&
        !f.startsWith('backup_'),
    )
  for (const f of currentDbFiles) {
    fs.unlinkSync(path.join(DATA_DIR, f))
  }

  // Copy backup files to data/
  for (const f of filesToRestore) {
    fs.copyFileSync(path.join(backupDir, f), path.join(DATA_DIR, f))
  }

  const dbCount = filesToRestore.filter((f) => f.endsWith('.db')).length
  consola.success(`Restored ${dbCount} database(s) from ${target}`)
}
