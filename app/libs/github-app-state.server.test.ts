import SQLite from 'better-sqlite3'
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { closeDb } from '~/app/services/db.server'
import { toOrgId } from '~/app/types/organization'
import {
  consumeInstallState,
  generateInstallState,
  InstallStateError,
} from './github-app-state.server'

const testDir = path.join(tmpdir(), `github-app-state-${Date.now()}`)
mkdirSync(testDir, { recursive: true })
const testDbPath = path.join(testDir, 'data.db')
writeFileSync(testDbPath, '')

const rawInit = new SQLite(testDbPath)
rawInit.exec(`
  CREATE TABLE organizations (
    id text NOT NULL PRIMARY KEY
  );
  CREATE TABLE github_app_install_states (
    id text NOT NULL PRIMARY KEY,
    organization_id text NOT NULL,
    nonce text NOT NULL,
    expires_at text NOT NULL,
    consumed_at text NULL,
    created_at text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    CONSTRAINT github_app_install_states_organization_id_fkey
      FOREIGN KEY (organization_id) REFERENCES organizations(id)
      ON UPDATE CASCADE ON DELETE CASCADE
  );
  CREATE UNIQUE INDEX github_app_install_states_nonce_key
    ON github_app_install_states (nonce);
`)
rawInit.close()

vi.stubEnv('UPFLOW_DATA_DIR', path.dirname(testDbPath))

describe('github-app-state', () => {
  const orgId = toOrgId('org-1')

  afterAll(async () => {
    await closeDb()
    vi.unstubAllEnvs()
  })

  beforeEach(async () => {
    await closeDb()
    const raw = new SQLite(testDbPath)
    raw.exec(
      'DELETE FROM github_app_install_states; DELETE FROM organizations;',
    )
    raw.prepare('INSERT INTO organizations (id) VALUES (?)').run(orgId)
    raw.close()
  })

  test('generate then consume returns organizationId', async () => {
    const nonce = await generateInstallState(orgId)
    const result = await consumeInstallState(nonce)
    expect(result.organizationId).toBe(orgId)
  })

  test('expired nonce rejects', async () => {
    const raw = new SQLite(testDbPath)
    raw
      .prepare(
        `INSERT INTO github_app_install_states (id, organization_id, nonce, expires_at, consumed_at)
         VALUES (?, ?, ?, ?, NULL)`,
      )
      .run(
        'stale-id',
        orgId,
        '00000000-0000-4000-8000-000000000001',
        '2000-01-01T00:00:00Z',
      )
    raw.close()

    await expect(
      consumeInstallState('00000000-0000-4000-8000-000000000001'),
    ).rejects.toThrow(InstallStateError)
  })

  test('unknown nonce rejects', async () => {
    await expect(
      consumeInstallState('00000000-0000-4000-8000-000000000099'),
    ).rejects.toThrow(InstallStateError)
  })

  test('consumed nonce cannot be reused', async () => {
    const nonce = await generateInstallState(orgId)
    await consumeInstallState(nonce)
    await expect(consumeInstallState(nonce)).rejects.toThrow(InstallStateError)
  })
})
