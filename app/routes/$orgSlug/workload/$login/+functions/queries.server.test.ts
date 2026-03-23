import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'
import { closeTenantDb, getTenantDb } from '~/app/services/tenant-db.server'
import { type OrganizationId, toOrgId } from '~/app/types/organization'
import { setupTenantSchema } from '~/test/setup-tenant-db'
import { getClosedPRs } from './queries.server'

const testDir = path.join(tmpdir(), `workload-login-queries-test-${Date.now()}`)
mkdirSync(testDir, { recursive: true })
const testDbPath = path.join(testDir, 'data.db')
writeFileSync(testDbPath, '')

vi.stubEnv('NODE_ENV', 'production')
vi.stubEnv('DATABASE_URL', `file://${testDbPath}`)

let testCounter = 0
function createFreshOrg(): OrganizationId {
  testCounter++
  const orgId = `test-workload-login-${Date.now()}-${testCounter}`
  const dbPath = path.join(testDir, `tenant_${orgId}.db`)
  setupTenantSchema(dbPath)
  return toOrgId(orgId)
}

async function seedRepository(orgId: OrganizationId) {
  const tenantDb = getTenantDb(orgId)

  await tenantDb
    .insertInto('integrations')
    .values({
      id: 'integration-1',
      provider: 'github',
      method: 'token',
      privateToken: null,
    })
    .execute()

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
    .execute()
}

async function insertPullRequest(
  orgId: OrganizationId,
  overrides: Partial<{
    repo: string
    number: number
    sourceBranch: string
    targetBranch: string
    state: 'open' | 'closed' | 'merged'
    author: string
    title: string
    url: string
    pullRequestCreatedAt: string
    mergedAt: string | null
    closedAt: string | null
    releasedAt: string | null
    repositoryId: string
    complexity: string | null
  }> = {},
) {
  const tenantDb = getTenantDb(orgId)
  await tenantDb
    .insertInto('pullRequests')
    .values({
      repo: 'widget',
      number: 1,
      sourceBranch: 'feature/test',
      targetBranch: 'main',
      state: 'closed',
      author: 'alice',
      title: 'Test PR',
      url: 'https://github.com/acme/widget/pull/1',
      firstCommittedAt: null,
      pullRequestCreatedAt: '2026-03-10T00:00:00Z',
      firstReviewedAt: null,
      mergedAt: null,
      closedAt: '2026-03-12T00:00:00Z',
      releasedAt: null,
      codingTime: null,
      pickupTime: null,
      reviewTime: null,
      deployTime: null,
      totalTime: null,
      repositoryId: 'repo-1',
      updatedAt: null,
      additions: null,
      deletions: null,
      changedFiles: null,
      complexity: 'M',
      complexityReason: null,
      riskAreas: null,
      classifiedAt: null,
      classifierModel: null,
      ...overrides,
    })
    .execute()
}

describe('workload member queries', () => {
  let orgId: OrganizationId

  afterAll(() => {
    vi.unstubAllEnvs()
  })

  beforeEach(async () => {
    orgId = createFreshOrg()
    await seedRepository(orgId)
  })

  afterEach(async () => {
    await closeTenantDb(orgId)
  })

  test('getClosedPRs returns only non-merged PRs closed in range for the author', async () => {
    await insertPullRequest(orgId, {
      number: 1,
      author: 'alice',
      closedAt: '2026-03-12T03:00:00Z',
      mergedAt: null,
    })
    await insertPullRequest(orgId, {
      number: 2,
      author: 'alice',
      closedAt: '2026-03-13T03:00:00Z',
      mergedAt: null,
      url: 'https://github.com/acme/widget/pull/2',
      title: 'Second in-range PR',
    })
    await insertPullRequest(orgId, {
      number: 5,
      author: 'alice',
      closedAt: '2026-03-13T04:00:00Z',
      mergedAt: '2026-03-13T02:00:00Z',
      releasedAt: '2026-03-14T02:00:00Z',
      url: 'https://github.com/acme/widget/pull/5',
      title: 'Merged PR should be excluded',
    })
    await insertPullRequest(orgId, {
      number: 3,
      author: 'bob',
      closedAt: '2026-03-12T04:00:00Z',
      mergedAt: null,
      url: 'https://github.com/acme/widget/pull/3',
      title: 'Other author PR',
    })
    await insertPullRequest(orgId, {
      number: 4,
      author: 'alice',
      closedAt: '2026-03-20T03:00:00Z',
      mergedAt: null,
      url: 'https://github.com/acme/widget/pull/4',
      title: 'Out of range PR',
    })

    const prs = await getClosedPRs(
      orgId,
      'ALICE',
      '2026-03-10T00:00:00Z',
      '2026-03-16T23:59:59Z',
    )

    expect(prs).toHaveLength(2)
    expect(prs[0].number).toBe(1)
    expect(prs[1].number).toBe(2)
    expect(prs[0].closedAt).toBe('2026-03-12T03:00:00Z')
    expect(prs[1].closedAt).toBe('2026-03-13T03:00:00Z')
  })
})
