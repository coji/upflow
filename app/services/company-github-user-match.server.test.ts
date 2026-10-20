import SQLite from 'better-sqlite3'
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, test, vi } from 'vitest'
import { closeDb } from '~/app/services/db.server'
import { getTenantDb } from '~/app/services/tenant-db.server'
import { type OrganizationId, toOrgId } from '~/app/types/organization'
import { setupTenantSchema } from '~/test/setup-tenant-db'
import {
  bindCompanyGithubUserId,
  findActiveCompanyGithubUser,
} from './company-github-user-match.server'

const testDir = path.join(tmpdir(), `company-github-user-match-${Date.now()}`)
mkdirSync(testDir, { recursive: true })
const sharedDbPath = path.join(testDir, 'data.db')
writeFileSync(sharedDbPath, '')
const rawShared = new SQLite(sharedDbPath)
rawShared.exec(`
  CREATE TABLE accounts (
    id text NOT NULL PRIMARY KEY, account_id text NOT NULL,
    provider_id text NOT NULL, user_id text NOT NULL
  );
  INSERT INTO accounts VALUES ('acc-1', '1001', 'github', 'user-original');
`)
rawShared.close()
vi.stubEnv('UPFLOW_DATA_DIR', testDir)

let counter = 0
function createOrg(): OrganizationId {
  counter++
  const orgId = `test-gh-match-${Date.now()}-${counter}`
  setupTenantSchema(path.join(testDir, `tenant_${orgId}.db`))
  return toOrgId(orgId)
}

async function seedUser(
  orgId: OrganizationId,
  row: {
    login: string
    isActive?: 0 | 1
    userId?: string | null
    githubUserId?: number | null
  },
) {
  await getTenantDb(orgId)
    .insertInto('companyGithubUsers')
    .values({
      login: row.login,
      displayName: row.login,
      isActive: row.isActive ?? 1,
      userId: row.userId ?? null,
      githubUserId: row.githubUserId ?? null,
      updatedAt: '2026-10-01T00:00:00Z',
    })
    .execute()
}

describe('findActiveCompanyGithubUser', () => {
  afterAll(async () => {
    await closeDb()
    vi.unstubAllEnvs()
  })

  test('bound row matches only its GitHub user ID', async () => {
    const orgId = createOrg()
    await seedUser(orgId, { login: 'alice', githubUserId: 1001 })
    const tenantDb = getTenantDb(orgId)

    // Someone else now holds the "alice" login
    expect(
      await findActiveCompanyGithubUser(tenantDb, { id: 2002, login: 'alice' }),
    ).toBeUndefined()
    // The original owner still matches after renaming their login
    expect(
      await findActiveCompanyGithubUser(tenantDb, {
        id: 1001,
        login: 'alice-renamed',
      }),
    ).toMatchObject({ login: 'alice' })
  })

  test('unbound row matches by login (case-insensitive) and can be bound', async () => {
    const orgId = createOrg()
    await seedUser(orgId, { login: 'bob' })
    const tenantDb = getTenantDb(orgId)

    const match = await findActiveCompanyGithubUser(tenantDb, {
      id: 3003,
      login: 'Bob',
    })
    expect(match).toMatchObject({ login: 'bob', githubUserId: null })

    await bindCompanyGithubUserId(tenantDb, 'bob', 3003)
    expect(
      await findActiveCompanyGithubUser(tenantDb, { id: 4004, login: 'bob' }),
    ).toBeUndefined()
  })

  test('binding never overwrites an existing GitHub user ID', async () => {
    const orgId = createOrg()
    await seedUser(orgId, { login: 'carol', githubUserId: 1001 })
    const tenantDb = getTenantDb(orgId)

    await bindCompanyGithubUserId(tenantDb, 'carol', 9999)
    expect(
      await findActiveCompanyGithubUser(tenantDb, { id: 1001, login: 'carol' }),
    ).toMatchObject({ githubUserId: 1001 })
  })

  test('unbound row linked to another GitHub account does not match', async () => {
    const orgId = createOrg()
    // Linked before IDs were recorded: user-original's GitHub account is 1001
    await seedUser(orgId, { login: 'dave', userId: 'user-original' })
    const tenantDb = getTenantDb(orgId)

    expect(
      await findActiveCompanyGithubUser(tenantDb, { id: 2002, login: 'dave' }),
    ).toBeUndefined()
    expect(
      await findActiveCompanyGithubUser(tenantDb, { id: 1001, login: 'dave' }),
    ).toMatchObject({ login: 'dave' })
  })

  test('inactive rows never match', async () => {
    const orgId = createOrg()
    await seedUser(orgId, { login: 'erin', isActive: 0 })
    await seedUser(orgId, { login: 'frank', isActive: 0, githubUserId: 5005 })
    const tenantDb = getTenantDb(orgId)

    expect(
      await findActiveCompanyGithubUser(tenantDb, { id: 1, login: 'erin' }),
    ).toBeUndefined()
    expect(
      await findActiveCompanyGithubUser(tenantDb, { id: 5005, login: 'frank' }),
    ).toBeUndefined()
  })
})
