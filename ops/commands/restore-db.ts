import consola from 'consola'
import fs from 'node:fs'
import path from 'node:path'
import { BACKUP_PREFIX, DATA_DIR, isDbFile } from '../lib/data-dir'

interface RestoreDbOptions {
  name?: string
}

function listBackups(): string[] {
  if (!fs.existsSync(DATA_DIR)) return []
  return fs
    .readdirSync(DATA_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name.startsWith(BACKUP_PREFIX))
    .map((d) => d.name)
    .sort()
    .reverse()
}

export async function restoreDbCommand(options: RestoreDbOptions) {
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
  const stat = fs.statSync(backupDir, { throwIfNoEntry: false })
  if (!stat?.isDirectory()) {
    consola.error(`Backup not found: ${target}`)
    consola.info('Run without --name to list available backups')
    process.exit(1)
  }

  const filesToRestore = fs.readdirSync(backupDir).filter(isDbFile)

  if (filesToRestore.length === 0) {
    consola.error(`No database files in backup: ${target}`)
    process.exit(1)
  }

  const dbCount = filesToRestore.filter((f) => f.endsWith('.db')).length
  consola.warn(
    `This will replace all current database files with ${dbCount} database(s) from ${target}.`,
  )
  consola.warn(
    'Ensure no batch jobs or dev server are accessing the databases.',
  )
  const confirmed = await consola.prompt('Continue with restore?', {
    type: 'confirm',
  })
  if (!confirmed) {
    consola.info('Restore cancelled')
    return
  }

  // Remove current db files
  const currentDbFiles = fs.readdirSync(DATA_DIR).filter(isDbFile)
  for (const f of currentDbFiles) {
    fs.unlinkSync(path.join(DATA_DIR, f))
  }

  // Copy backup files to data/
  for (const f of filesToRestore) {
    fs.copyFileSync(path.join(backupDir, f), path.join(DATA_DIR, f))
  }

  consola.success(`Restored ${dbCount} database(s) from ${target}`)
}
