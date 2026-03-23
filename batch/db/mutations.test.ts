import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { closeTenantDb, getTenantDb } from '~/app/services/tenant-db.server'
import type { OrganizationId } from '~/app/types/organization'
import { setupTenantSchema } from '~/test/setup-tenant-db'
import { upsertCompanyGithubUsers } from './mutations'

const testDir = path.join(tmpdir(), `mutations-test-${Date.now()}`)
mkdirSync(testDir, { recursive: true })
const testDbPath = path.join(testDir, 'data.db')
writeFileSync(testDbPath, '')

vi.stubEnv('NODE_ENV', 'production')
vi.stubEnv('DATABASE_URL', `file://${testDbPath}`)

const orgId = `test-org-${Date.now()}` as OrganizationId

const tenantDbPath = path.join(testDir, `tenant_${orgId}.db`)
setupTenantSchema(tenantDbPath)

afterEach(async () => {
  // Clear rows between tests
  const tenantDb = getTenantDb(orgId)
  await tenantDb.deleteFrom('companyGithubUsers').execute()
})

afterEach(async () => {
  await closeTenantDb(orgId)
})

describe('upsertCompanyGithubUsers', () => {
  test('normalizes logins to lowercase', async () => {
    await upsertCompanyGithubUsers(orgId, ['Coji', 'ALICE'])

    const tenantDb = getTenantDb(orgId)
    const rows = await tenantDb
      .selectFrom('companyGithubUsers')
      .select(['login'])
      .orderBy('login')
      .execute()

    expect(rows).toEqual([{ login: 'alice' }, { login: 'coji' }])
  })

  test('deduplicates case-variant logins into a single row', async () => {
    await upsertCompanyGithubUsers(orgId, ['Coji', 'coji', 'COJI'])

    const tenantDb = getTenantDb(orgId)
    const rows = await tenantDb
      .selectFrom('companyGithubUsers')
      .select(['login'])
      .execute()

    expect(rows).toHaveLength(1)
    expect(rows[0].login).toBe('coji')
  })

  test('inserts with isActive=0 by default', async () => {
    await upsertCompanyGithubUsers(orgId, ['bob'])

    const tenantDb = getTenantDb(orgId)
    const row = await tenantDb
      .selectFrom('companyGithubUsers')
      .select(['login', 'isActive'])
      .executeTakeFirstOrThrow()

    expect(row).toEqual({ login: 'bob', isActive: 0 })
  })

  test('does not overwrite existing rows', async () => {
    const tenantDb = getTenantDb(orgId)
    await tenantDb
      .insertInto('companyGithubUsers')
      .values({
        login: 'coji',
        displayName: 'Custom Name',
        isActive: 1,
        updatedAt: new Date().toISOString(),
      })
      .execute()

    await upsertCompanyGithubUsers(orgId, ['coji'])

    const row = await tenantDb
      .selectFrom('companyGithubUsers')
      .select(['login', 'displayName', 'isActive'])
      .where('login', '=', 'coji')
      .executeTakeFirstOrThrow()

    expect(row.displayName).toBe('Custom Name')
    expect(row.isActive).toBe(1)
  })

  test('skips when given empty array', async () => {
    await upsertCompanyGithubUsers(orgId, [])

    const tenantDb = getTenantDb(orgId)
    const rows = await tenantDb
      .selectFrom('companyGithubUsers')
      .select(['login'])
      .execute()

    expect(rows).toHaveLength(0)
  })
})
