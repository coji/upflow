/**
 * Apply tenant migrations to all tenant DBs.
 * Scans data/ directory for tenant_*.db files and applies Atlas migrations.
 * Also used during db:setup to apply migrations to newly created tenant DBs.
 */
import { consola } from 'consola'
import { execFileSync } from 'node:child_process'
import { readdirSync } from 'node:fs'

const dataDir = './data'

function getTenantDbFiles(): string[] {
  try {
    return readdirSync(dataDir).filter(
      (f) => f.startsWith('tenant_') && f.endsWith('.db'),
    )
  } catch {
    return []
  }
}

function applyMigrations(dbFile: string) {
  const url = `sqlite://${dataDir}/${dbFile}`
  consola.info(`Applying tenant migrations to ${dbFile}...`)
  execFileSync('atlas', ['migrate', 'apply', '--env', 'tenant', '--url', url], {
    stdio: 'inherit',
  })
}

const tenantDbs = getTenantDbFiles()
if (tenantDbs.length === 0) {
  consola.info('No tenant databases found. Skipping tenant migrations.')
} else {
  for (const dbFile of tenantDbs) {
    applyMigrations(dbFile)
  }
  consola.info(`Applied tenant migrations to ${tenantDbs.length} database(s).`)
}
