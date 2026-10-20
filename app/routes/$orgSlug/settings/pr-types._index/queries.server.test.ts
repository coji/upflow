import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, test, vi } from 'vitest'
import { getTenantDb } from '~/app/services/tenant-db.server'
import { toOrgId } from '~/app/types/organization'
import { setupTenantSchema } from '~/test/setup-tenant-db'
import {
  countPullRequestsByType,
  listSignalConflictPullRequests,
} from './queries.server'

const testDir = path.join(tmpdir(), `pr-types-settings-test-${Date.now()}`)
mkdirSync(testDir, { recursive: true })
vi.stubEnv('UPFLOW_DATA_DIR', testDir)

afterAll(() => {
  vi.unstubAllEnvs()
})

const orgId = toOrgId(`test-pr-types-${Date.now()}`)
setupTenantSchema(path.join(testDir, `tenant_${orgId}.db`))

async function seedPr(
  number: number,
  prType: string | null,
  prTypeWarning: string | null = null,
) {
  await getTenantDb(orgId)
    .insertInto('pullRequests')
    .values({
      repo: 'widget',
      number,
      sourceBranch: 'feature/x',
      targetBranch: 'main',
      state: 'merged',
      author: 'alice',
      title: `PR ${number}`,
      url: `https://github.com/acme/widget/pull/${number}`,
      pullRequestCreatedAt: `2026-10-0${number}T00:00:00Z`,
      repositoryId: 'repo-1',
      prType,
      prTypeWarning,
    })
    .execute()
}

describe('PR types settings queries', () => {
  test('counts PRs per type and lists naming conflicts newest first', async () => {
    await getTenantDb(orgId)
      .insertInto('repositories')
      .values({
        id: 'repo-1',
        integrationId: 'integration-1',
        provider: 'github',
        owner: 'acme',
        repo: 'widget',
        updatedAt: '2026-10-01T00:00:00Z',
      })
      .execute()
    await seedPr(1, 'normal')
    await seedPr(2, 'release', 'signal-conflict')
    await seedPr(3, 'release')
    await seedPr(4, null)
    await seedPr(5, 'template-merge', 'signal-conflict')

    const counts = await countPullRequestsByType(orgId)
    expect(counts).toEqual(
      expect.arrayContaining([
        { prType: 'normal', count: 1 },
        { prType: 'release', count: 2 },
        { prType: 'template-merge', count: 1 },
        { prType: null, count: 1 },
      ]),
    )

    const conflicts = await listSignalConflictPullRequests(orgId)
    expect(conflicts.map((c) => c.number)).toEqual([5, 2])
    expect(conflicts[0]).toMatchObject({ owner: 'acme', repo: 'widget' })
  })
})
