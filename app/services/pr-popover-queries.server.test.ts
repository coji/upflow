import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, test, vi } from 'vitest'
import { getTenantDb } from '~/app/services/tenant-db.server'
import { type OrganizationId, toOrgId } from '~/app/types/organization'
import { setupTenantSchema } from '~/test/setup-tenant-db'
import { getPullRequestForPopover } from './pr-popover-queries.server'

const testDir = path.join(tmpdir(), `pr-popover-queries-test-${Date.now()}`)
mkdirSync(testDir, { recursive: true })
const testDbPath = path.join(testDir, 'data.db')
writeFileSync(testDbPath, '')

vi.stubEnv('UPFLOW_DATA_DIR', path.dirname(testDbPath))

let testCounter = 0
function createFreshOrg(): OrganizationId {
  testCounter++
  const orgId = `test-pr-popover-${Date.now()}-${testCounter}`
  const dbPath = path.join(testDir, `tenant_${orgId}.db`)
  setupTenantSchema(dbPath)
  return toOrgId(orgId)
}

async function seedRepository(orgId: OrganizationId, repoId = 'repo-1') {
  const tenantDb = getTenantDb(orgId)
  await tenantDb
    .insertInto('repositories')
    .values({
      id: repoId,
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

async function seedGithubUser(
  orgId: OrganizationId,
  login: string,
  displayName: string,
) {
  await getTenantDb(orgId)
    .insertInto('companyGithubUsers')
    .values({
      login,
      displayName,
      type: 'User',
      isActive: 1,
      updatedAt: '2026-03-01T00:00:00Z',
    })
    .execute()
}

async function insertOpenPullRequest(
  orgId: OrganizationId,
  overrides: Partial<{
    number: number
    repositoryId: string
    author: string
    title: string
  }> = {},
) {
  await getTenantDb(orgId)
    .insertInto('pullRequests')
    .values({
      repo: 'widget',
      number: 1,
      sourceBranch: 'feature/test',
      targetBranch: 'main',
      state: 'open',
      author: 'alice',
      title: 'Test PR',
      url: 'https://github.com/acme/widget/pull/1',
      firstCommittedAt: null,
      pullRequestCreatedAt: '2026-03-10T00:00:00Z',
      firstReviewedAt: null,
      mergedAt: null,
      closedAt: null,
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

describe('getPullRequestForPopover', () => {
  afterAll(() => {
    vi.unstubAllEnvs()
  })

  test('returns full enrichment when PR exists', async () => {
    const orgId = createFreshOrg()
    await seedRepository(orgId)
    await seedGithubUser(orgId, 'alice', 'Alice A')
    await seedGithubUser(orgId, 'bob', 'Bob B')
    await insertOpenPullRequest(orgId)
    await getTenantDb(orgId)
      .insertInto('pullRequestReviews')
      .values({
        id: 'rev-1',
        pullRequestNumber: 1,
        repositoryId: 'repo-1',
        reviewer: 'bob',
        state: 'APPROVED',
        submittedAt: '2026-03-11T00:00:00Z',
        url: 'https://github.com/acme/widget/pull/1#review-1',
      })
      .execute()

    const pr = await getPullRequestForPopover(orgId, 'repo-1', 1)
    expect(pr).not.toBeNull()
    expect(pr?.author).toBe('alice')
    expect(pr?.authorDisplayName).toBe('Alice A')
    expect(pr?.reviewStatus).toBe('approved-awaiting-merge')
    expect(pr?.reviewerStates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          login: 'bob',
          displayName: 'Bob B',
          state: 'APPROVED',
        }),
      ]),
    )
  })

  test('returns null when PR does not exist', async () => {
    const orgId = createFreshOrg()
    await seedRepository(orgId)
    const pr = await getPullRequestForPopover(orgId, 'repo-1', 99)
    expect(pr).toBeNull()
  })

  test('returns null for another org tenant (same repositoryId)', async () => {
    const orgA = createFreshOrg()
    const orgB = createFreshOrg()
    await seedRepository(orgA, 'repo-shared')
    await seedGithubUser(orgA, 'alice', 'Alice A')
    await insertOpenPullRequest(orgA, { repositoryId: 'repo-shared' })
    await seedRepository(orgB, 'repo-shared')

    const pr = await getPullRequestForPopover(orgB, 'repo-shared', 1)
    expect(pr).toBeNull()
  })
})
