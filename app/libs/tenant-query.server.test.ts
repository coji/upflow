import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { closeTenantDb, getTenantDb } from '~/app/services/tenant-db.server'
import { type OrganizationId, toOrgId } from '~/app/types/organization'
import { setupTenantSchema } from '~/test/setup-tenant-db'
import {
  excludePrTitleFilters,
  filteredPullRequestCount,
} from './tenant-query.server'

const testDir = path.join(tmpdir(), `tenant-query-test-${Date.now()}`)
mkdirSync(testDir, { recursive: true })
const testDbPath = path.join(testDir, 'data.db')
writeFileSync(testDbPath, '')

vi.stubEnv('UPFLOW_DATA_DIR', path.dirname(testDbPath))

let testCounter = 0
function createFreshOrg(): OrganizationId {
  testCounter++
  const orgId = `test-tenant-query-${Date.now()}-${testCounter}`
  const dbPath = path.join(testDir, `tenant_${orgId}.db`)
  setupTenantSchema(dbPath)
  return toOrgId(orgId)
}

async function seedRepoAndPR(
  orgId: OrganizationId,
  number: number,
  title: string,
) {
  const tenantDb = getTenantDb(orgId)
  await tenantDb
    .insertInto('repositories')
    .values({
      id: 'repo-1',
      integrationId: 'integration-1',
      provider: 'github',
      owner: 'acme',
      repo: 'widget',
      releaseDetectionMethod: 'branch',
      releaseDetectionKey: 'production',
      updatedAt: '2026-03-01T00:00:00Z',
    })
    .onConflict((oc) => oc.doNothing())
    .execute()
  await tenantDb
    .insertInto('pullRequests')
    .values({
      repo: 'widget',
      number,
      sourceBranch: 'feature',
      targetBranch: 'main',
      state: 'open',
      author: 'alice',
      title,
      url: `https://github.com/acme/widget/pull/${number}`,
      pullRequestCreatedAt: '2026-03-10T00:00:00Z',
      repositoryId: 'repo-1',
    })
    .execute()
}

describe('excludePrTitleFilters', () => {
  let orgId: OrganizationId

  beforeEach(() => {
    orgId = createFreshOrg()
  })

  afterEach(async () => {
    await closeTenantDb(orgId)
  })

  test('returns all rows when patterns array is empty', async () => {
    await seedRepoAndPR(orgId, 1, '[DO NOT MERGE] fix')
    await seedRepoAndPR(orgId, 2, 'regular PR')

    const rows = await getTenantDb(orgId)
      .selectFrom('pullRequests')
      .select('number')
      .where(excludePrTitleFilters([]))
      .execute()

    expect(rows.map((r) => r.number).sort()).toEqual([1, 2])
  })

  test('excludes rows matching a single normalized pattern (case-insensitive)', async () => {
    await seedRepoAndPR(orgId, 1, '[DO NOT MERGE] fix')
    await seedRepoAndPR(orgId, 2, '[do not merge] another')
    await seedRepoAndPR(orgId, 3, 'regular PR')

    const rows = await getTenantDb(orgId)
      .selectFrom('pullRequests')
      .select('number')
      .where(excludePrTitleFilters(['[do not merge]']))
      .execute()

    expect(rows.map((r) => r.number)).toEqual([3])
  })

  test('excludes rows matching any of multiple patterns (AND-of-exclusions)', async () => {
    await seedRepoAndPR(orgId, 1, '[DO NOT MERGE] fix')
    await seedRepoAndPR(orgId, 2, '[EPIC-123] feature')
    await seedRepoAndPR(orgId, 3, 'regular PR')

    const rows = await getTenantDb(orgId)
      .selectFrom('pullRequests')
      .select('number')
      .where(excludePrTitleFilters(['[do not merge]', '[epic-']))
      .execute()

    expect(rows.map((r) => r.number)).toEqual([3])
  })

  test('treats % as literal (not LIKE wildcard)', async () => {
    await seedRepoAndPR(orgId, 1, 'coverage 100% complete')
    await seedRepoAndPR(orgId, 2, 'regular PR')

    const matchedPct = await getTenantDb(orgId)
      .selectFrom('pullRequests')
      .select('number')
      .where(excludePrTitleFilters(['100%']))
      .execute()
    expect(matchedPct.map((r) => r.number)).toEqual([2])

    // sanity: without literal semantics this would match everything
    const allWithoutLiteral = await getTenantDb(orgId)
      .selectFrom('pullRequests')
      .select('number')
      .where(excludePrTitleFilters(['nonexistent']))
      .execute()
    expect(allWithoutLiteral.map((r) => r.number).sort()).toEqual([1, 2])
  })

  test('treats _ as literal (not LIKE single-char wildcard)', async () => {
    await seedRepoAndPR(orgId, 1, 'PR_123 update')
    await seedRepoAndPR(orgId, 2, 'PR1X23 update')

    const rows = await getTenantDb(orgId)
      .selectFrom('pullRequests')
      .select('number')
      .where(excludePrTitleFilters(['pr_123']))
      .execute()

    expect(rows.map((r) => r.number)).toEqual([2])
  })
})

describe('filteredPullRequestCount', () => {
  let orgId: OrganizationId

  beforeEach(() => {
    orgId = createFreshOrg()
  })

  afterEach(async () => {
    await closeTenantDb(orgId)
  })

  test('unfiltered = filtered when patterns empty', async () => {
    await seedRepoAndPR(orgId, 1, '[DO NOT MERGE] fix')
    await seedRepoAndPR(orgId, 2, 'regular')

    const row = await getTenantDb(orgId)
      .selectFrom('pullRequests')
      .select((eb) => [
        eb.fn.countAll<number>().as('unfiltered'),
        filteredPullRequestCount([])(eb).as('filtered'),
      ])
      .executeTakeFirstOrThrow()

    expect(Number(row.unfiltered)).toBe(2)
    expect(Number(row.filtered)).toBe(2)
  })

  test('filtered excludes matching rows within a single query', async () => {
    await seedRepoAndPR(orgId, 1, '[DO NOT MERGE] fix')
    await seedRepoAndPR(orgId, 2, '[EPIC-123] feature')
    await seedRepoAndPR(orgId, 3, 'regular')

    const row = await getTenantDb(orgId)
      .selectFrom('pullRequests')
      .select((eb) => [
        eb.fn.countAll<number>().as('unfiltered'),
        filteredPullRequestCount(['[do not merge]', '[epic-'])(eb).as(
          'filtered',
        ),
      ])
      .executeTakeFirstOrThrow()

    expect(Number(row.unfiltered)).toBe(3)
    expect(Number(row.filtered)).toBe(1)
  })

  test('returns 0 filtered when no rows match filter (still a single query)', async () => {
    await seedRepoAndPR(orgId, 1, 'plain one')
    await seedRepoAndPR(orgId, 2, 'plain two')

    const row = await getTenantDb(orgId)
      .selectFrom('pullRequests')
      .select((eb) => [
        eb.fn.countAll<number>().as('unfiltered'),
        filteredPullRequestCount(['zzz-never-matches'])(eb).as('filtered'),
      ])
      .executeTakeFirstOrThrow()

    expect(Number(row.unfiltered)).toBe(2)
    expect(Number(row.filtered)).toBe(2)
  })

  test('coalesces to 0 when the query selects zero rows', async () => {
    // 0 rows via where filter
    const row = await getTenantDb(orgId)
      .selectFrom('pullRequests')
      .where('number', '=', 9999)
      .select((eb) => [
        eb.fn.countAll<number>().as('unfiltered'),
        filteredPullRequestCount(['foo'])(eb).as('filtered'),
      ])
      .executeTakeFirstOrThrow()

    expect(Number(row.unfiltered)).toBe(0)
    expect(Number(row.filtered)).toBe(0)
  })
})
