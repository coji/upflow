import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { getOrgCachedData } from '~/app/services/cache.server'
import {
  createPrTitleFilter,
  deletePrTitleFilter,
  updatePrTitleFilter,
} from '~/app/services/pr-title-filter-mutations.server'
import { closeTenantDb, getTenantDb } from '~/app/services/tenant-db.server'
import { type OrganizationId, toOrgId } from '~/app/types/organization'
import { setupTenantSchema } from '~/test/setup-tenant-db'

const testDir = path.join(tmpdir(), `pr-filter-mutations-test-${Date.now()}`)
mkdirSync(testDir, { recursive: true })
vi.stubEnv('UPFLOW_DATA_DIR', testDir)

let testCounter = 0
function createFreshOrg(): OrganizationId {
  testCounter++
  const orgId = `pr-filter-mut-${Date.now()}-${testCounter}`
  const dbPath = path.join(testDir, `tenant_${orgId}.db`)
  setupTenantSchema(dbPath)
  return toOrgId(orgId)
}

describe('pr-title-filter mutations', () => {
  let orgId: OrganizationId

  beforeEach(() => {
    orgId = createFreshOrg()
  })

  afterEach(async () => {
    await closeTenantDb(orgId)
  })

  test('createPrTitleFilter stores trimmed pattern and NFC-normalized lowercased form', async () => {
    const { id } = await createPrTitleFilter(orgId, {
      pattern: '  [WIP]  ',
      userId: 'user-1',
    })

    const row = await getTenantDb(orgId)
      .selectFrom('prTitleFilters')
      .select([
        'id',
        'pattern',
        'normalizedPattern',
        'isEnabled',
        'createdBy',
        'updatedBy',
      ])
      .where('id', '=', id)
      .executeTakeFirstOrThrow()

    expect(row.pattern).toBe('[WIP]')
    expect(row.normalizedPattern).toBe('[wip]')
    expect(row.isEnabled).toBe(1)
    expect(row.createdBy).toBe('user-1')
    expect(row.updatedBy).toBe('user-1')
  })

  test('createPrTitleFilter throws on duplicate normalized pattern', async () => {
    await createPrTitleFilter(orgId, { pattern: '[WIP]', userId: 'u1' })
    await expect(
      createPrTitleFilter(orgId, { pattern: '[wip]', userId: 'u2' }),
    ).rejects.toThrow(/UNIQUE/i)
  })

  test('createPrTitleFilter rejects Unicode-equivalent duplicate (NFC)', async () => {
    // precomposed "Café" vs decomposed "Cafe\u0301"
    await createPrTitleFilter(orgId, { pattern: 'Caf\u00e9', userId: 'u1' })
    await expect(
      createPrTitleFilter(orgId, { pattern: 'Cafe\u0301', userId: 'u2' }),
    ).rejects.toThrow(/UNIQUE/i)
  })

  test('createPrTitleFilter supports explicit isEnabled=false', async () => {
    const { id } = await createPrTitleFilter(orgId, {
      pattern: '[WIP]',
      userId: 'u',
      isEnabled: false,
    })
    const row = await getTenantDb(orgId)
      .selectFrom('prTitleFilters')
      .select('isEnabled')
      .where('id', '=', id)
      .executeTakeFirstOrThrow()
    expect(row.isEnabled).toBe(0)
  })

  test('updatePrTitleFilter recomputes normalizedPattern and touches updatedBy', async () => {
    const { id } = await createPrTitleFilter(orgId, {
      pattern: '[WIP]',
      userId: 'u1',
    })

    await updatePrTitleFilter(orgId, id, {
      pattern: '[DO NOT MERGE]',
      userId: 'u2',
    })

    const row = await getTenantDb(orgId)
      .selectFrom('prTitleFilters')
      .select(['pattern', 'normalizedPattern', 'updatedBy'])
      .where('id', '=', id)
      .executeTakeFirstOrThrow()

    expect(row.pattern).toBe('[DO NOT MERGE]')
    expect(row.normalizedPattern).toBe('[do not merge]')
    expect(row.updatedBy).toBe('u2')
  })

  test('updatePrTitleFilter can toggle isEnabled independently of pattern', async () => {
    const { id } = await createPrTitleFilter(orgId, {
      pattern: '[WIP]',
      userId: 'u',
    })
    await updatePrTitleFilter(orgId, id, { isEnabled: false, userId: 'u' })
    const row = await getTenantDb(orgId)
      .selectFrom('prTitleFilters')
      .select(['pattern', 'isEnabled'])
      .where('id', '=', id)
      .executeTakeFirstOrThrow()
    expect(row.pattern).toBe('[WIP]')
    expect(row.isEnabled).toBe(0)
  })

  test('deletePrTitleFilter removes the row', async () => {
    const { id } = await createPrTitleFilter(orgId, {
      pattern: '[WIP]',
      userId: 'u',
    })
    await deletePrTitleFilter(orgId, id)
    const row = await getTenantDb(orgId)
      .selectFrom('prTitleFilters')
      .select('id')
      .where('id', '=', id)
      .executeTakeFirst()
    expect(row).toBeUndefined()
  })

  test('every mutation clears the org cache so cached loaders see fresh data', async () => {
    const cacheKey = 'test-key'
    let loaderCalls = 0
    const load = (value: string) => () => {
      loaderCalls++
      return Promise.resolve(value)
    }
    // populate cache
    await getOrgCachedData(orgId, cacheKey, load('cached-value'))
    expect(loaderCalls).toBe(1)

    await createPrTitleFilter(orgId, { pattern: '[WIP]', userId: 'u' })
    const afterCreate = await getOrgCachedData(
      orgId,
      cacheKey,
      load('fresh-after-create'),
    )
    expect(afterCreate).toBe('fresh-after-create')
    expect(loaderCalls).toBe(2)

    const { id } = await getTenantDb(orgId)
      .selectFrom('prTitleFilters')
      .select('id')
      .executeTakeFirstOrThrow()

    await updatePrTitleFilter(orgId, id, { isEnabled: false, userId: 'u' })
    const afterUpdate = await getOrgCachedData(
      orgId,
      cacheKey,
      load('fresh-after-update'),
    )
    expect(afterUpdate).toBe('fresh-after-update')
    expect(loaderCalls).toBe(3)

    await deletePrTitleFilter(orgId, id)
    const afterDelete = await getOrgCachedData(
      orgId,
      cacheKey,
      load('fresh-after-delete'),
    )
    expect(afterDelete).toBe('fresh-after-delete')
    expect(loaderCalls).toBe(4)
  })
})
