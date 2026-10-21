import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { PrFilterPattern } from '~/app/libs/pr-title-filter'
import { closeTenantDb, getTenantDb } from '~/app/services/tenant-db.server'
import { type OrganizationId, toOrgId } from '~/app/types/organization'
import { setupTenantSchema } from '~/test/setup-tenant-db'
import {
  excludeBots,
  excludePrTitleFilters,
  filterPrTypes,
} from './tenant-query.server'

const testDir = path.join(tmpdir(), `tenant-query-test-${Date.now()}`)
mkdirSync(testDir, { recursive: true })
vi.stubEnv('UPFLOW_DATA_DIR', testDir)

let testCounter = 0
function createFreshOrg(): OrganizationId {
  testCounter++
  const orgId = `test-tenant-query-${Date.now()}-${testCounter}`
  const dbPath = path.join(testDir, `tenant_${orgId}.db`)
  setupTenantSchema(dbPath)
  return toOrgId(orgId)
}

const byTitle = (pattern: string): PrFilterPattern => ({
  target: 'title',
  pattern,
})
const byBranch = (pattern: string): PrFilterPattern => ({
  target: 'branch',
  pattern,
})

async function seedRepoAndPR(
  orgId: OrganizationId,
  number: number,
  title: string,
  sourceBranch = 'feature',
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
      sourceBranch,
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
      .where(excludePrTitleFilters([byTitle('[do not merge]')]))
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
      .where(
        excludePrTitleFilters([byTitle('[do not merge]'), byTitle('[epic-')]),
      )
      .execute()

    expect(rows.map((r) => r.number)).toEqual([3])
  })

  test('treats % as literal (not LIKE wildcard)', async () => {
    await seedRepoAndPR(orgId, 1, 'coverage 100% complete')
    await seedRepoAndPR(orgId, 2, 'regular PR')

    const matchedPct = await getTenantDb(orgId)
      .selectFrom('pullRequests')
      .select('number')
      .where(excludePrTitleFilters([byTitle('100%')]))
      .execute()
    expect(matchedPct.map((r) => r.number)).toEqual([2])

    // sanity: without literal semantics this would match everything
    const allWithoutLiteral = await getTenantDb(orgId)
      .selectFrom('pullRequests')
      .select('number')
      .where(excludePrTitleFilters([byTitle('nonexistent')]))
      .execute()
    expect(allWithoutLiteral.map((r) => r.number).sort()).toEqual([1, 2])
  })

  test('branch patterns match the source branch, not the title', async () => {
    await seedRepoAndPR(orgId, 1, 'Release 2026-10-06', 'release/2026-10-06')
    await seedRepoAndPR(orgId, 2, 'release/ notes in title', 'feature/notes')
    await seedRepoAndPR(orgId, 3, 'regular PR', 'feature/regular')

    const rows = await getTenantDb(orgId)
      .selectFrom('pullRequests')
      .select('number')
      .where(excludePrTitleFilters([byBranch('release/')]))
      .execute()

    expect(rows.map((r) => r.number).sort()).toEqual([2, 3])
  })

  test('title and branch patterns combine as AND-of-exclusions', async () => {
    await seedRepoAndPR(orgId, 1, '[WIP] draft', 'feature/a')
    await seedRepoAndPR(orgId, 2, 'Bump version', 'release/1.2.0')
    await seedRepoAndPR(orgId, 3, 'regular PR', 'feature/b')

    const rows = await getTenantDb(orgId)
      .selectFrom('pullRequests')
      .select('number')
      .where(excludePrTitleFilters([byTitle('[wip]'), byBranch('release/')]))
      .execute()

    expect(rows.map((r) => r.number)).toEqual([3])
  })

  test('treats _ as literal (not LIKE single-char wildcard)', async () => {
    await seedRepoAndPR(orgId, 1, 'PR_123 update')
    await seedRepoAndPR(orgId, 2, 'PR1X23 update')

    const rows = await getTenantDb(orgId)
      .selectFrom('pullRequests')
      .select('number')
      .where(excludePrTitleFilters([byTitle('pr_123')]))
      .execute()

    expect(rows.map((r) => r.number)).toEqual([2])
  })
})

describe('filterPrTypes', () => {
  let orgId: OrganizationId

  beforeEach(() => {
    orgId = createFreshOrg()
  })

  afterEach(async () => {
    await closeTenantDb(orgId)
  })

  async function seedTyped(
    number: number,
    prType: string | null,
    author = 'alice',
  ) {
    await seedRepoAndPR(orgId, number, `PR ${number}`)
    await getTenantDb(orgId)
      .updateTable('pullRequests')
      .set({ prType, author })
      .where('number', '=', number)
      .execute()
  }

  async function numbersFor(
    allowed: Parameters<typeof filterPrTypes>[0],
    withoutBots = false,
  ) {
    const rows = await getTenantDb(orgId)
      .selectFrom('pullRequests')
      .leftJoin('companyGithubUsers', (join) =>
        join.onRef(
          (eb) => eb.fn('lower', ['pullRequests.author']),
          '=',
          (eb) => eb.fn('lower', ['companyGithubUsers.login']),
        ),
      )
      .select('pullRequests.number')
      .where(filterPrTypes(allowed))
      .$if(withoutBots, (qb) => qb.where(excludeBots))
      .execute()
    return rows.map((r) => r.number).sort()
  }

  test('keeps normal and not-yet-classified PRs by default', async () => {
    await seedTyped(1, 'normal')
    await seedTyped(2, null)
    await seedTyped(3, 'release')
    await seedTyped(4, 'template-merge')
    await seedTyped(5, 'dependency')

    expect(await numbersFor(['normal'])).toEqual([1, 2])
  })

  test('adds the explicitly included types', async () => {
    await seedTyped(1, 'normal')
    await seedTyped(2, 'release')
    await seedTyped(3, 'dependency')

    expect(await numbersFor(['normal', 'release'])).toEqual([1, 2])
  })

  test('does not filter when every type is allowed', async () => {
    await seedTyped(1, 'normal')
    await seedTyped(2, 'release')
    await seedTyped(3, 'template-merge')
    await seedTyped(4, 'dependency')

    expect(
      await numbersFor(['normal', 'release', 'template-merge', 'dependency']),
    ).toEqual([1, 2, 3, 4])
  })

  test('ANDs with excludeBots: including dependency keeps bot PRs out', async () => {
    await seedTyped(1, 'normal')
    await seedTyped(2, 'dependency', 'renovate')
    await getTenantDb(orgId)
      .insertInto('companyGithubUsers')
      .values({
        login: 'renovate',
        displayName: 'renovate',
        type: 'Bot',
        isActive: 0,
        updatedAt: '2026-03-01T00:00:00Z',
      })
      .execute()

    expect(await numbersFor(['normal', 'dependency'], true)).toEqual([1])
    expect(await numbersFor(['normal', 'dependency'])).toEqual([1, 2])
  })
})
