import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, test, vi } from 'vitest'
import { getTenantDb } from '~/app/services/tenant-db.server'
import { type OrganizationId, toOrgId } from '~/app/types/organization'
import { setupTenantSchema } from '~/test/setup-tenant-db'
import { collectProcessWorkSet, markProcessed } from './process-work-set.server'

const testDir = path.join(tmpdir(), `process-work-set-test-${Date.now()}`)
mkdirSync(testDir, { recursive: true })
writeFileSync(path.join(testDir, 'data.db'), '')

vi.stubEnv('UPFLOW_DATA_DIR', testDir)

afterAll(() => {
  vi.unstubAllEnvs()
})

let testCounter = 0
async function createOrg(): Promise<OrganizationId> {
  testCounter++
  const orgId = toOrgId(`test-work-set-${Date.now()}-${testCounter}`)
  setupTenantSchema(path.join(testDir, `tenant_${orgId}.db`))
  for (const id of ['repo-1', 'repo-2']) {
    await getTenantDb(orgId)
      .insertInto('repositories')
      .values({
        id,
        integrationId: 'integration-1',
        provider: 'github',
        owner: 'acme',
        repo: id,
        updatedAt: '2026-03-01T00:00:00Z',
      })
      .execute()
  }
  return orgId
}

async function saveRaw(
  orgId: OrganizationId,
  repositoryId: string,
  pullRequestNumber: number,
  fetchedAt: string,
) {
  await getTenantDb(orgId)
    .insertInto('githubRawData')
    .values({
      repositoryId,
      pullRequestNumber,
      pullRequest: '{}',
      commits: '[]',
      reviews: '[]',
      discussions: '[]',
      fetchedAt,
    })
    .onConflict((oc) =>
      oc
        .columns(['repositoryId', 'pullRequestNumber'])
        .doUpdateSet({ fetchedAt }),
    )
    .execute()
}

describe('collectProcessWorkSet', () => {
  test('returns only raw rows not yet processed', async () => {
    const orgId = await createOrg()
    await saveRaw(orgId, 'repo-1', 1, '2026-10-01T00:00:00Z')
    await saveRaw(orgId, 'repo-1', 2, '2026-10-01T00:00:00Z')
    await saveRaw(orgId, 'repo-2', 3, '2026-10-01T00:00:00Z')
    await markProcessed(orgId, [
      { repositoryId: 'repo-1', prs: [[1, '2026-10-01T00:00:00Z']] },
    ])

    const workSet = await collectProcessWorkSet(orgId, { fullOrg: false })

    expect(workSet).toEqual([
      { repositoryId: 'repo-1', prs: [[2, '2026-10-01T00:00:00Z']] },
      { repositoryId: 'repo-2', prs: [[3, '2026-10-01T00:00:00Z']] },
    ])
  })

  test('a refetched row becomes dirty again', async () => {
    const orgId = await createOrg()
    await saveRaw(orgId, 'repo-1', 1, '2026-10-01T00:00:00Z')
    await markProcessed(orgId, [
      { repositoryId: 'repo-1', prs: [[1, '2026-10-01T00:00:00Z']] },
    ])
    await saveRaw(orgId, 'repo-1', 1, '2026-10-02T00:00:00Z')

    const workSet = await collectProcessWorkSet(orgId, { fullOrg: false })

    expect(workSet).toEqual([
      { repositoryId: 'repo-1', prs: [[1, '2026-10-02T00:00:00Z']] },
    ])
  })

  test('fullOrg and include select processed rows too', async () => {
    const orgId = await createOrg()
    await saveRaw(orgId, 'repo-1', 1, '2026-10-01T00:00:00Z')
    await saveRaw(orgId, 'repo-2', 2, '2026-10-01T00:00:00Z')
    await markProcessed(orgId, [
      { repositoryId: 'repo-1', prs: [[1, '2026-10-01T00:00:00Z']] },
      { repositoryId: 'repo-2', prs: [[2, '2026-10-01T00:00:00Z']] },
    ])

    expect(await collectProcessWorkSet(orgId, { fullOrg: true })).toHaveLength(
      2,
    )
    expect(
      await collectProcessWorkSet(orgId, {
        fullOrg: false,
        include: [{ repositoryId: 'repo-2', prNumbers: [2] }],
      }),
    ).toEqual([{ repositoryId: 'repo-2', prs: [[2, '2026-10-01T00:00:00Z']] }])
  })
})

describe('markProcessed', () => {
  test('does not mark a row refetched after the snapshot', async () => {
    const orgId = await createOrg()
    await saveRaw(orgId, 'repo-1', 1, '2026-10-01T00:00:00Z')
    const snapshot = await collectProcessWorkSet(orgId, { fullOrg: false })

    // A crawl refetches the PR while process is running.
    await saveRaw(orgId, 'repo-1', 1, '2026-10-02T00:00:00Z')
    await markProcessed(orgId, snapshot)

    expect(await collectProcessWorkSet(orgId, { fullOrg: false })).toEqual([
      { repositoryId: 'repo-1', prs: [[1, '2026-10-02T00:00:00Z']] },
    ])
  })
})
