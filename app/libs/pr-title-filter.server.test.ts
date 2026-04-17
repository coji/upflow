import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { createPrTitleFilter } from '~/app/services/pr-title-filter-mutations.server'
import { closeTenantDb } from '~/app/services/tenant-db.server'
import { type OrganizationId, toOrgId } from '~/app/types/organization'
import { setupTenantSchema } from '~/test/setup-tenant-db'
import {
  computeExcludedCount,
  loadPrFilterState,
} from './pr-title-filter.server'

const testDir = path.join(tmpdir(), `pr-filter-server-test-${Date.now()}`)
mkdirSync(testDir, { recursive: true })
vi.stubEnv('UPFLOW_DATA_DIR', testDir)

let testCounter = 0
function createFreshOrg(): OrganizationId {
  testCounter++
  const orgId = `pr-filter-server-${Date.now()}-${testCounter}`
  const dbPath = path.join(testDir, `tenant_${orgId}.db`)
  setupTenantSchema(dbPath)
  return toOrgId(orgId)
}

const makeRequest = (search: string) =>
  new Request(`http://example.com/foo${search}`)

describe('loadPrFilterState', () => {
  let orgId: OrganizationId

  beforeEach(() => {
    orgId = createFreshOrg()
  })

  afterEach(async () => {
    await closeTenantDb(orgId)
  })

  test('returns filterActive=false and hasAnyEnabledPattern=false when DB is empty', async () => {
    const state = await loadPrFilterState(makeRequest(''), orgId)
    expect(state).toEqual({
      showFiltered: false,
      normalizedPatterns: [],
      filterActive: false,
      hasAnyEnabledPattern: false,
    })
  })

  test('returns enabled patterns and filterActive=true when registered', async () => {
    await createPrTitleFilter(orgId, { pattern: '[WIP]', userId: 'u' })
    await createPrTitleFilter(orgId, {
      pattern: '[DO NOT MERGE]',
      userId: 'u',
    })

    const state = await loadPrFilterState(makeRequest(''), orgId)
    expect(state.showFiltered).toBe(false)
    expect(state.filterActive).toBe(true)
    expect(state.normalizedPatterns.slice().sort()).toEqual(
      ['[do not merge]', '[wip]'].sort(),
    )
  })

  test('disabled filters are not included in normalizedPatterns', async () => {
    await createPrTitleFilter(orgId, { pattern: '[WIP]', userId: 'u' })
    await createPrTitleFilter(orgId, {
      pattern: '[DISABLED]',
      userId: 'u',
      isEnabled: false,
    })

    const state = await loadPrFilterState(makeRequest(''), orgId)
    expect(state.normalizedPatterns).toEqual(['[wip]'])
  })

  test('showFiltered=1 bypasses patterns but keeps hasAnyEnabledPattern flag', async () => {
    await createPrTitleFilter(orgId, { pattern: '[WIP]', userId: 'u' })

    const state = await loadPrFilterState(makeRequest('?showFiltered=1'), orgId)
    expect(state).toEqual({
      showFiltered: true,
      normalizedPatterns: [],
      filterActive: false,
      hasAnyEnabledPattern: true,
    })
  })

  test('hasAnyEnabledPattern=false when only disabled filters exist', async () => {
    await createPrTitleFilter(orgId, {
      pattern: '[WIP]',
      userId: 'u',
      isEnabled: false,
    })

    const state = await loadPrFilterState(makeRequest('?showFiltered=1'), orgId)
    expect(state.hasAnyEnabledPattern).toBe(false)
  })

  test('any other value of showFiltered is not treated as truthy', async () => {
    await createPrTitleFilter(orgId, { pattern: '[WIP]', userId: 'u' })

    const state = await loadPrFilterState(
      makeRequest('?showFiltered=true'),
      orgId,
    )
    expect(state.showFiltered).toBe(false)
    expect(state.filterActive).toBe(true)
  })
})

describe('computeExcludedCount', () => {
  test('returns 0 when filter is not active (no DB query)', async () => {
    const counter = vi.fn()
    const result = await computeExcludedCount(
      {
        showFiltered: false,
        normalizedPatterns: [],
        filterActive: false,
        hasAnyEnabledPattern: false,
      },
      counter,
    )
    expect(result).toBe(0)
    expect(counter).not.toHaveBeenCalled()
  })

  test('returns unfiltered - filtered via single counter call', async () => {
    const counter = vi.fn(async () => ({ unfiltered: 10, filtered: 7 }))
    const result = await computeExcludedCount(
      {
        showFiltered: false,
        normalizedPatterns: ['[wip]'],
        filterActive: true,
        hasAnyEnabledPattern: true,
      },
      counter,
    )
    expect(result).toBe(3)
    expect(counter).toHaveBeenCalledTimes(1)
    expect(counter).toHaveBeenCalledWith(['[wip]'])
  })

  test('passes the actual normalizedPatterns array to counter', async () => {
    const patterns = ['[wip]', '[epic-'] as const
    const counter = vi.fn(async () => ({ unfiltered: 5, filtered: 2 }))
    await computeExcludedCount(
      {
        showFiltered: false,
        normalizedPatterns: patterns,
        filterActive: true,
        hasAnyEnabledPattern: true,
      },
      counter,
    )
    expect(counter).toHaveBeenCalledWith(patterns)
  })
})
