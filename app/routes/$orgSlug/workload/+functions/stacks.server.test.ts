import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { closeTenantDb, getTenantDb } from '~/app/services/tenant-db.server'
import { type OrganizationId, toOrgId } from '~/app/types/organization'
import { setupTenantSchema } from '~/test/setup-tenant-db'
import {
  countHiddenDrafts,
  countOpenPullRequests,
  getOpenPullRequests,
  getPendingReviewAssignments,
} from './stacks.server'

const testDir = path.join(tmpdir(), `stacks-server-test-${Date.now()}`)
mkdirSync(testDir, { recursive: true })
vi.stubEnv('UPFLOW_DATA_DIR', testDir)

let testCounter = 0
function createFreshOrg(): OrganizationId {
  testCounter++
  const orgId = `test-stacks-${Date.now()}-${testCounter}`
  setupTenantSchema(path.join(testDir, `tenant_${orgId}.db`))
  return toOrgId(orgId)
}

describe('Review Stacks PR type filter', () => {
  let orgId: OrganizationId

  beforeEach(async () => {
    orgId = createFreshOrg()
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
      .execute()
    const prs = [
      { number: 1, sourceBranch: 'feature/a', prType: 'normal', isDraft: 0 },
      {
        number: 2,
        sourceBranch: 'release/2026-03-10',
        prType: 'release',
        isDraft: 0,
      },
      { number: 3, sourceBranch: 'feature/b', prType: null, isDraft: 1 },
      {
        number: 4,
        sourceBranch: 'release/2026-03-11',
        prType: 'release',
        isDraft: 1,
      },
    ]
    for (const pr of prs) {
      await tenantDb
        .insertInto('pullRequests')
        .values({
          repo: 'widget',
          number: pr.number,
          sourceBranch: pr.sourceBranch,
          targetBranch: 'main',
          state: 'open',
          author: 'alice',
          title: `PR ${pr.number}`,
          url: `https://github.com/acme/widget/pull/${pr.number}`,
          pullRequestCreatedAt: '2026-03-10T00:00:00Z',
          repositoryId: 'repo-1',
          prType: pr.prType,
          isDraft: pr.isDraft,
        })
        .execute()
      await tenantDb
        .insertInto('pullRequestReviewers')
        .values({
          repositoryId: 'repo-1',
          pullRequestNumber: pr.number,
          reviewer: 'bob',
          requestedAt: '2026-03-10T01:00:00Z',
        })
        .execute()
    }
  })

  afterEach(async () => {
    await closeTenantDb(orgId)
  })

  test('excludes release PRs by default', async () => {
    const open = await getOpenPullRequests(orgId)
    expect(open.map((pr) => pr.number).sort()).toEqual([1, 3])

    const pending = await getPendingReviewAssignments(orgId)
    expect(pending.map((pr) => pr.number).sort()).toEqual([1, 3])

    expect(await countOpenPullRequests(orgId)).toEqual({
      unfiltered: 2,
      filtered: 2,
    })
    expect(await countHiddenDrafts(orgId)).toBe(1)
  })

  test('includes release PRs when requested', async () => {
    const open = await getOpenPullRequests(orgId, null, [], false, [
      'normal',
      'release',
    ])
    expect(open.map((pr) => pr.number).sort()).toEqual([1, 2, 3, 4])
    expect(
      await countHiddenDrafts(orgId, null, [], ['normal', 'release']),
    ).toBe(2)
  })
})
