import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, test, vi } from 'vitest'
import { closeDb } from '~/app/services/db.server'
import { getTenantDb } from '~/app/services/tenant-db.server'
import { type OrganizationId, toOrgId } from '~/app/types/organization'
import { setupTenantSchema } from '~/test/setup-tenant-db'
import { upsertExportSetting } from './mutations.server'
import { getExportSettingForDisplay } from './queries.server'

const testDir = path.join(tmpdir(), `settings-mutations-${Date.now()}`)
mkdirSync(testDir, { recursive: true })
writeFileSync(path.join(testDir, 'data.db'), '')
vi.stubEnv('UPFLOW_DATA_DIR', testDir)

let counter = 0
function createOrg(): OrganizationId {
  counter++
  const orgId = `test-settings-${Date.now()}-${counter}`
  setupTenantSchema(path.join(testDir, `tenant_${orgId}.db`))
  return toOrgId(orgId)
}

const readSetting = (orgId: OrganizationId) =>
  getTenantDb(orgId)
    .selectFrom('exportSettings')
    .select(['sheetId', 'clientEmail', 'privateKey'])
    .executeTakeFirst()

afterAll(async () => {
  await closeDb()
  vi.unstubAllEnvs()
})

describe('upsertExportSetting', () => {
  test('requires a private key when none is stored', async () => {
    const orgId = createOrg()
    await expect(
      upsertExportSetting(orgId, {
        sheetId: 'sheet',
        clientEmail: 'sa@example.com',
        privateKey: '',
      }),
    ).rejects.toThrow('Private key is required')
    expect(await readSetting(orgId)).toBeUndefined()
  })

  test('blank private key keeps the stored key', async () => {
    const orgId = createOrg()
    await upsertExportSetting(orgId, {
      sheetId: 'sheet',
      clientEmail: 'sa@example.com',
      privateKey: 'KEY-1',
    })
    await upsertExportSetting(orgId, {
      sheetId: 'sheet-2',
      clientEmail: 'sa2@example.com',
      privateKey: '',
    })
    expect(await readSetting(orgId)).toEqual({
      sheetId: 'sheet-2',
      clientEmail: 'sa2@example.com',
      privateKey: 'KEY-1',
    })
  })

  test('a new private key replaces the stored key', async () => {
    const orgId = createOrg()
    await upsertExportSetting(orgId, {
      sheetId: 'sheet',
      clientEmail: 'sa@example.com',
      privateKey: 'KEY-1',
    })
    await upsertExportSetting(orgId, {
      sheetId: 'sheet',
      clientEmail: 'sa@example.com',
      privateKey: 'KEY-2',
    })
    expect((await readSetting(orgId))?.privateKey).toBe('KEY-2')
  })
})

describe('getExportSettingForDisplay', () => {
  test('never returns the private key', async () => {
    const orgId = createOrg()
    expect(await getExportSettingForDisplay(orgId)).toBeUndefined()

    await upsertExportSetting(orgId, {
      sheetId: 'sheet',
      clientEmail: 'sa@example.com',
      privateKey: 'SECRET-KEY',
    })
    const display = await getExportSettingForDisplay(orgId)
    expect(display).toEqual({
      sheetId: 'sheet',
      clientEmail: 'sa@example.com',
      hasPrivateKey: true,
    })
    expect(JSON.stringify(display)).not.toContain('SECRET-KEY')
  })
})
