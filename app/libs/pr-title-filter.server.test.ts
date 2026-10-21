import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { createPrTitleFilter } from '~/app/services/pr-title-filter-mutations.server'
import { closeTenantDb } from '~/app/services/tenant-db.server'
import { type OrganizationId, toOrgId } from '~/app/types/organization'
import { setupTenantSchema } from '~/test/setup-tenant-db'
import { toHiddenPrSummary, loadPrFilterState } from './pr-title-filter.server'

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
  new URL(`http://example.com/foo${search}`)

describe('loadPrFilterState', () => {
  let orgId: OrganizationId

  beforeEach(() => {
    orgId = createFreshOrg()
  })

  afterEach(async () => {
    await closeTenantDb(orgId)
  })

  test('returns filterActive=false and no patterns when DB is empty', async () => {
    const state = await loadPrFilterState(makeRequest(''), orgId)
    expect(state).toEqual({
      showFiltered: false,
      normalizedPatterns: [],
      enabledPatterns: [],
      filterActive: false,
      prTypes: ['normal'],
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
    expect(state.normalizedPatterns.map((p) => p.pattern).sort()).toEqual(
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
    expect(state.normalizedPatterns).toEqual([
      { target: 'title', pattern: '[wip]' },
    ])
  })

  test('showFiltered=1 bypasses patterns but keeps the enabled patterns for counting', async () => {
    await createPrTitleFilter(orgId, { pattern: '[WIP]', userId: 'u' })

    const state = await loadPrFilterState(makeRequest('?showFiltered=1'), orgId)
    expect(state).toEqual({
      showFiltered: true,
      normalizedPatterns: [],
      enabledPatterns: [{ target: 'title', pattern: '[wip]' }],
      filterActive: false,
      prTypes: ['normal'],
    })
  })

  test('returns branch patterns with their target', async () => {
    await createPrTitleFilter(orgId, {
      target: 'branch',
      pattern: 'Release/',
      userId: 'u',
    })

    const state = await loadPrFilterState(makeRequest(''), orgId)
    expect(state.normalizedPatterns).toEqual([
      { target: 'branch', pattern: 'release/' },
    ])
  })

  test('bracketed patterns stay strings (not parsed as JSON)', async () => {
    await createPrTitleFilter(orgId, { pattern: '[1]', userId: 'u' })
    const state = await loadPrFilterState(makeRequest(''), orgId)
    expect(state.normalizedPatterns).toEqual([
      { target: 'title', pattern: '[1]' },
    ])
  })

  test('the same pattern can be registered for title and branch', async () => {
    await createPrTitleFilter(orgId, { pattern: 'release', userId: 'u' })
    await createPrTitleFilter(orgId, {
      target: 'branch',
      pattern: 'release',
      userId: 'u',
    })
    await expect(
      createPrTitleFilter(orgId, { pattern: 'Release', userId: 'u' }),
    ).rejects.toThrow(/UNIQUE/)
  })

  test('reads the PR types to include from ?prTypes=', async () => {
    const state = await loadPrFilterState(
      makeRequest('?prTypes=release'),
      orgId,
    )
    expect(state.prTypes).toEqual(['normal', 'release'])
  })

  test('enabledPatterns is empty when only disabled filters exist', async () => {
    await createPrTitleFilter(orgId, {
      pattern: '[WIP]',
      userId: 'u',
      isEnabled: false,
    })

    const state = await loadPrFilterState(makeRequest('?showFiltered=1'), orgId)
    expect(state.enabledPatterns).toEqual([])
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

describe('toHiddenPrSummary', () => {
  const row = {
    hiddenRelease: 2,
    hiddenTemplateMerge: 0,
    hiddenDependency: '4',
    hiddenDraft: 3,
    hiddenFilter: 1,
  }

  test('sums only the active reasons into hiddenCount', () => {
    const summary = toHiddenPrSummary(row, {
      prTypes: ['normal', 'dependency'],
      typesApplicable: true,
      enabledPatterns: [{ target: 'branch', pattern: 'release/' }],
      filterActive: true,
      hideDrafts: false,
    })
    expect(summary.reasons).toEqual([
      { reason: 'release', active: true, count: 2 },
      { reason: 'template-merge', active: true, count: 0 },
      { reason: 'dependency', active: false, count: 4 },
      { reason: 'draft', active: false, count: 3 },
      { reason: 'filter', active: true, count: 1 },
    ])
    expect(summary.hiddenCount).toBe(3)
  })

  test('drops type rows on pages without the type filter', () => {
    const summary = toHiddenPrSummary(row, {
      prTypes: ['normal'],
      typesApplicable: false,
      enabledPatterns: [{ target: 'title', pattern: '[wip]' }],
      filterActive: false,
    })
    expect(summary.reasons).toEqual([
      { reason: 'filter', active: false, count: 1 },
    ])
    expect(summary.hiddenCount).toBe(0)
  })
})
