import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { closeTenantDb, getTenantDb } from '~/app/services/tenant-db.server'
import { type OrganizationId, toOrgId } from '~/app/types/organization'
import { setupTenantSchema } from '~/test/setup-tenant-db'
import type { HiddenPrReason, HiddenPrSummary } from '~/app/libs/hidden-prs'
import { toHiddenPrSummary } from '~/app/libs/pr-title-filter.server'
import type { HiddenPrBreakdownInput } from '~/app/libs/tenant-query.server'
import {
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

  const summarize = async (
    input: Partial<HiddenPrBreakdownInput> = {},
  ): Promise<HiddenPrSummary> => {
    const breakdown: HiddenPrBreakdownInput = {
      prTypes: ['normal'],
      typesApplicable: true,
      enabledPatterns: [],
      filterActive: false,
      hideDrafts: false,
      ...input,
    }
    return toHiddenPrSummary(
      await countOpenPullRequests(orgId, null, breakdown),
      breakdown,
    )
  }
  const countOf = (summary: HiddenPrSummary, reason: HiddenPrReason) =>
    summary.reasons.find((r) => r.reason === reason)

  test('excludes release PRs by default', async () => {
    const open = await getOpenPullRequests(orgId)
    expect(open.map((pr) => pr.number).sort()).toEqual([1, 3])

    const pending = await getPendingReviewAssignments(orgId)
    expect(pending.map((pr) => pr.number).sort()).toEqual([1, 3])
  })

  test('includes release PRs when requested', async () => {
    const open = await getOpenPullRequests(orgId, null, [], false, [
      'normal',
      'release',
    ])
    expect(open.map((pr) => pr.number).sort()).toEqual([1, 2, 3, 4])
  })

  test('counts each hidden PR under the first active reason only', async () => {
    // release は既定で隠す。Draft の release PR (#4) は release 側にだけ数える
    const byDefault = await summarize()
    expect(countOf(byDefault, 'release')).toEqual({
      reason: 'release',
      active: true,
      count: 2,
    })
    expect(countOf(byDefault, 'draft')).toEqual({
      reason: 'draft',
      active: false,
      count: 1,
    })
    expect(byDefault.hiddenCount).toBe(2)

    const withDrafts = await summarize({ hideDrafts: true })
    expect(withDrafts.hiddenCount).toBe(3)

    // release を表示に戻すと、Draft 行が #4 も数える
    const releaseShown = await summarize({
      prTypes: ['normal', 'release'],
      hideDrafts: true,
    })
    expect(countOf(releaseShown, 'release')?.active).toBe(false)
    expect(countOf(releaseShown, 'draft')?.count).toBe(2)
    expect(releaseShown.hiddenCount).toBe(2)
  })

  test('a branch pattern overlapping the release type is not double-counted', async () => {
    const patterns: HiddenPrBreakdownInput['enabledPatterns'] = [
      { target: 'branch', pattern: 'release/' },
    ]
    const both = await summarize({
      enabledPatterns: patterns,
      filterActive: true,
    })
    expect(countOf(both, 'filter')?.count).toBe(0)
    expect(both.hiddenCount).toBe(2)

    const filterOnly = await summarize({
      prTypes: ['normal', 'release'],
      enabledPatterns: patterns,
      filterActive: true,
    })
    expect(countOf(filterOnly, 'filter')?.count).toBe(2)
    expect(filterOnly.hiddenCount).toBe(2)
  })

  test('omits the filter row when no pattern is registered and the draft row when the page has no draft toggle', async () => {
    const summary = await summarize({ hideDrafts: undefined })
    expect(summary.reasons.map((r) => r.reason)).toEqual([
      'release',
      'template-merge',
      'dependency',
    ])
  })
})
