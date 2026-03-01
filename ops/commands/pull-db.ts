import Database from 'better-sqlite3'
import consola from 'consola'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const DATA_DIR = 'data'
const REMOTE_DATA_DIR = '/upflow/data'
const VALID_APP_NAME = /^[a-z0-9-]+$/
const VALID_DB_FILENAME = /^[\w.-]+\.db$/

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

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupDir = path.join(DATA_DIR, `backup_${timestamp}`)
  fs.mkdirSync(backupDir, { recursive: true })

  const files = fs
    .readdirSync(DATA_DIR)
    .filter(
      (f) =>
        f.endsWith('.db') || f.endsWith('.db-wal') || f.endsWith('.db-shm'),
    )
  for (const file of files) {
    const src = path.join(DATA_DIR, file)
    const dest = path.join(backupDir, file)
    fs.copyFileSync(src, dest)
    consola.debug(`Backed up ${file}`)
  }
  consola.success(`Backed up ${files.length} files to ${backupDir}`)
}

function listRemoteTenantDbs(app: string): string[] {
  consola.start('Listing remote tenant databases...')
  try {
    const output = execSync(
      `fly ssh console -a ${app} -C "sh -c 'ls ${REMOTE_DATA_DIR}/tenant_*.db'"`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] },
    )
    return output
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => path.basename(line.trim()))
      .filter((name) => VALID_DB_FILENAME.test(name))
  } catch (error) {
    const stderr =
      error instanceof Error && 'stderr' in error
        ? String((error as { stderr: unknown }).stderr)
        : ''
    consola.warn(
      `No tenant databases found or command failed${stderr ? `: ${stderr.trim()}` : ''}`,
    )
    return []
  }
}

/**
 * リモート DB の WAL をメイン DB ファイルにフラッシュする。
 * WAL モードで動作中の DB は -wal ファイルに未コミットの変更を持つため、
 * .db ファイルだけ pull すると不整合（orphan index 等）が発生する。
 */
function checkpointRemoteDbs(app: string, dbFiles: string[]) {
  consola.start('Checkpointing remote databases (flushing WAL)...')
  let succeeded = 0
  for (const f of dbFiles) {
    const dbPath = `${REMOTE_DATA_DIR}/${f}`
    try {
      execSync(
        `fly ssh console -a ${app} -C 'sqlite3 ${dbPath} "PRAGMA wal_checkpoint(TRUNCATE);"'`,
        { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] },
      )
      succeeded++
    } catch {
      consola.warn(
        `WAL checkpoint failed for ${f}, will pull WAL files instead`,
      )
    }
  }
  if (succeeded > 0) {
    consola.success(`Checkpointed ${succeeded}/${dbFiles.length} database(s)`)
  }
}

function pullFile(app: string, remoteFile: string, localFile: string) {
  // fly ssh sftp get refuses to overwrite existing files
  if (fs.existsSync(localFile)) {
    fs.unlinkSync(localFile)
  }
  consola.start(`Pulling ${remoteFile}...`)
  execSync(`fly ssh sftp get -a ${app} ${remoteFile} ${localFile}`, {
    stdio: 'inherit',
  })
}

function tryPullFile(app: string, remoteFile: string, localFile: string) {
  try {
    pullFile(app, remoteFile, localFile)
  } catch {
    // WAL/SHM files may not exist (e.g. after checkpoint), ignore
  }
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

  // Step 2: List tenant databases
  const tenantDbs = listRemoteTenantDbs(app)
  const filesToPull = ['data.db', ...tenantDbs]

  consola.info(
    `Found ${filesToPull.length} database(s): ${filesToPull.join(', ')}`,
  )

  // Step 3: Checkpoint WAL on remote before pulling
  checkpointRemoteDbs(app, filesToPull)

  // Step 4: Pull each file (+ WAL/SHM as fallback)
  let pulledCount = 0
  for (const file of filesToPull) {
    try {
      pullFile(app, `${REMOTE_DATA_DIR}/${file}`, path.join(DATA_DIR, file))
      // Also pull WAL and SHM files if they exist (safety net)
      tryPullFile(
        app,
        `${REMOTE_DATA_DIR}/${file}-wal`,
        path.join(DATA_DIR, `${file}-wal`),
      )
      tryPullFile(
        app,
        `${REMOTE_DATA_DIR}/${file}-shm`,
        path.join(DATA_DIR, `${file}-shm`),
      )
      pulledCount++
    } catch (error) {
      consola.error(`Failed to pull ${file}:`, error)
    }
  }

  consola.success(`Pulled ${pulledCount}/${filesToPull.length} database(s)`)

  // Step 5: Sanitize export settings in all pulled databases
  if (!noSanitize) {
    consola.start('Sanitizing export settings...')
    for (const file of filesToPull) {
      const dbPath = path.join(DATA_DIR, file)
      if (fs.existsSync(dbPath)) {
        sanitizeExportSettings(dbPath)
      }
    }
    consola.success('Sanitization complete')
  }

  consola.box(
    [
      `Pull complete: ${pulledCount} file(s)`,
      noSanitize ? 'Sanitization: skipped' : 'Sanitization: done',
      noBackup ? 'Backup: skipped' : 'Backup: done',
    ].join('\n'),
  )
}
