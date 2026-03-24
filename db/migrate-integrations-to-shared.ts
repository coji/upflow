/**
 * One-time (idempotent) copy of `integrations` rows from each tenant DB into the shared DB.
 * Run after shared migrations add `integrations`, before tenant migrations drop tenant `integrations`.
 */
import Database from 'better-sqlite3'
import { consola } from 'consola'
import 'dotenv/config'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { resolveDataDir } from './data-dir'

const dataDir = resolveDataDir()

function hasTable(db: InstanceType<typeof Database>, name: string): boolean {
  const row = db
    .prepare(
      "SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = ?",
    )
    .get(name) as { ok: number } | undefined
  return row !== undefined
}

function migrate(): void {
  const sharedPath = join(dataDir, 'data.db')
  if (!existsSync(sharedPath)) {
    throw new Error(
      `Shared DB not found at ${sharedPath}. Check UPFLOW_DATA_DIR (current: ${process.env.UPFLOW_DATA_DIR ?? '(unset)'}).`,
    )
  }

  const shared = new Database(sharedPath)

  try {
    if (!hasTable(shared, 'integrations')) {
      consola.info('Shared DB has no integrations table yet; skipping copy.')
      return
    }

    const orgExists = shared.prepare(
      'SELECT 1 FROM organizations WHERE id = ? LIMIT 1',
    )
    const upsert = shared.prepare(`
      INSERT INTO integrations (
        id, organization_id, provider, method, private_token,
        created_at, updated_at
      ) VALUES (
        @id, @organization_id, @provider, @method, @private_token,
        strftime('%Y-%m-%dT%H:%M:%SZ', 'now'),
        strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
      )
      ON CONFLICT(organization_id) DO UPDATE SET
        id = excluded.id,
        provider = excluded.provider,
        method = excluded.method,
        private_token = excluded.private_token,
        updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
    `)

    let files: string[]
    try {
      files = readdirSync(dataDir)
    } catch {
      consola.info('No data directory; skipping tenant integrations copy.')
      return
    }

    let copied = 0
    for (const name of files) {
      if (!name.startsWith('tenant_') || !name.endsWith('.db')) continue
      const organizationId = name.slice('tenant_'.length, -'.db'.length)
      if (!orgExists.get(organizationId)) continue

      const tenantPath = join(dataDir, name)
      const tenant = new Database(tenantPath, { readonly: true })
      try {
        if (!hasTable(tenant, 'integrations')) continue
        const row = tenant
          .prepare(
            'SELECT id, provider, method, private_token FROM integrations LIMIT 1',
          )
          .get() as
          | {
              id: string
              provider: string
              method: string
              private_token: string | null
            }
          | undefined
        if (!row) continue

        upsert.run({
          id: row.id,
          organization_id: organizationId,
          provider: row.provider,
          method: row.method,
          private_token: row.private_token,
        })
        copied++
      } finally {
        tenant.close()
      }
    }

    if (copied > 0) {
      consola.info(
        `Copied integrations from ${copied} tenant DB(s) into shared DB.`,
      )
    } else {
      consola.info(
        'No tenant integrations rows to copy (already migrated or empty).',
      )
    }
  } finally {
    shared.close()
  }
}

migrate()
