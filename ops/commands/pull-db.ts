import Database from 'better-sqlite3'
import consola from 'consola'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import {
  BACKUP_PREFIX,
  DATA_DIR,
  isDbFile,
  removeAllDbFiles,
} from '../lib/data-dir'

const VALID_APP_NAME = /^[a-z0-9-]+$/

interface PullDbOptions {
  app: string
  noBackup: boolean
  noSanitize: boolean
}

function validateAppName(app: string) {
  if (!VALID_APP_NAME.test(app)) {
    consola.error(`Invalid app name: ${app}`)
    process.exit(1)
  }
}

function backupExistingData() {
  if (!fs.existsSync(DATA_DIR)) {
    consola.info('No existing data/ directory, skipping backup')
    return
  }

  const dbFiles = fs.readdirSync(DATA_DIR).filter(isDbFile)
  if (dbFiles.length === 0) {
    consola.info('No database files to back up')
    return
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupDir = path.join(DATA_DIR, `${BACKUP_PREFIX}${timestamp}`)
  fs.mkdirSync(backupDir, { recursive: true })

  for (const file of dbFiles) {
    fs.copyFileSync(path.join(DATA_DIR, file), path.join(backupDir, file))
  }
  consola.success(`Backed up ${dbFiles.length} files to ${backupDir}`)
}

/**
 * リモートの prepare-pull.sh を実行して tar.gz を作成し、
 * 1回の SFTP で取得して展開する。
 */
function pullAllDbs(app: string) {
  const remoteTar = '/tmp/upflow-data.tar.gz'
  const localTar = path.join(DATA_DIR, '_pull.tar.gz')

  // Step 1: リモートで .backup + tar.gz 作成
  consola.start('Remote: creating atomic backups and archive...')
  const output = execFileSync(
    'fly',
    [
      'ssh',
      'console',
      '-a',
      app,
      '-C',
      'sh /upflow/ops/remote/prepare-pull.sh',
    ],
    { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] },
  )

  // Parse file list from output between ---FILES--- and ---DONE---
  const lines = output.split('\n').map((l) => l.trim())
  const startIdx = lines.indexOf('---FILES---')
  const endIdx = lines.indexOf('---DONE---')
  const dbFiles =
    startIdx >= 0 && endIdx > startIdx
      ? lines.slice(startIdx + 1, endIdx).filter(Boolean)
      : []

  if (dbFiles.length === 0) {
    consola.error('No database files found on remote')
    process.exit(1)
  }
  consola.success(
    `Remote archive ready: ${dbFiles.length} database(s) — ${dbFiles.join(', ')}`,
  )

  // Step 2: 1回の SFTP で tar.gz を取得
  consola.start('Pulling archive...')
  try {
    fs.unlinkSync(localTar)
  } catch {
    // file may not exist
  }
  execFileSync('fly', ['ssh', 'sftp', 'get', '-a', app, remoteTar, localTar], {
    stdio: 'inherit',
  })

  // Step 3: ローカルで展開
  consola.start('Extracting archive...')
  execFileSync('tar', ['xzf', path.resolve(localTar)], {
    cwd: DATA_DIR,
    stdio: 'inherit',
  })
  fs.unlinkSync(localTar)

  consola.success(`Pulled ${dbFiles.length} database(s)`)
  return dbFiles
}

function sanitizeExportSettings(dbPath: string) {
  const db = new Database(dbPath)
  try {
    const tableExists = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='export_settings'",
      )
      .get()
    if (!tableExists) return

    const result = db
      .prepare(
        "UPDATE export_settings SET sheet_id = '', client_email = '', private_key = ''",
      )
      .run()
    if (result.changes > 0) {
      consola.success(
        `Sanitized ${result.changes} export_settings row(s) in ${path.basename(dbPath)}`,
      )
    }
  } finally {
    db.close()
  }
}

export function pullDbCommand(options: PullDbOptions) {
  const { app, noBackup, noSanitize } = options

  validateAppName(app)

  consola.info(`Pulling databases from Fly app: ${app}`)

  // Step 1: Backup existing data
  if (!noBackup) {
    backupExistingData()
  }

  // Ensure data directory exists
  fs.mkdirSync(DATA_DIR, { recursive: true })

  // Step 2: Remove old DB files (including -wal/-shm) to prevent
  // stale WAL journals from corrupting newly pulled databases
  consola.start('Removing old database files...')
  removeAllDbFiles()

  // Step 3: Remote backup + tar + pull + extract
  const dbFiles = pullAllDbs(app)

  // Step 4: Sanitize export settings
  if (!noSanitize) {
    consola.start('Sanitizing export settings...')
    for (const file of dbFiles) {
      sanitizeExportSettings(path.join(DATA_DIR, file))
    }
    consola.success('Sanitization complete')
  }

  consola.box(
    [
      `Pull complete: ${dbFiles.length} database(s)`,
      noSanitize ? 'Sanitization: skipped' : 'Sanitization: done',
      noBackup ? 'Backup: skipped' : 'Backup: done',
    ].join('\n'),
  )
}
