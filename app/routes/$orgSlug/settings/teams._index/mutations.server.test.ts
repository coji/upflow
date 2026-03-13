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
import { setupTenantSchema } from '~/test/setup-tenant-db'

const testDir = path.join(tmpdir(), `teams-mutations-test-${Date.now()}`)
mkdirSync(testDir, { recursive: true })
const testDbPath = path.join(testDir, 'data.db')
writeFileSync(testDbPath, '')

vi.stubEnv('NODE_ENV', 'production')
vi.stubEnv('DATABASE_URL', `file://${testDbPath}`)

const { closeTenantDb } = await import('~/app/services/tenant-db.server')
type OrganizationId = import('~/app/types/organization').OrganizationId
const toOrgId = (s: string) => s as OrganizationId

const { addTeam, updateTeam, deleteTeam } = await import('./mutations.server')
const { listTeams } = await import('./queries.server')

let testCounter = 0
function createFreshOrg(): OrganizationId {
  testCounter++
  const orgId = `test-teams-${Date.now()}-${testCounter}`
  const dbPath = path.join(testDir, `tenant_${orgId}.db`)
  setupTenantSchema(dbPath)
  return toOrgId(orgId)
}

describe('teams mutations', () => {
  let orgId: OrganizationId

  afterAll(() => {
    vi.unstubAllEnvs()
  })

  beforeEach(() => {
    orgId = createFreshOrg()
  })

  afterEach(async () => {
    await closeTenantDb(orgId)
  })

  test('addTeam inserts a new team', async () => {
    await addTeam({ organizationId: orgId, name: 'Frontend', displayOrder: 1 })
    const teams = await listTeams(orgId)
    expect(teams).toHaveLength(1)
    expect(teams[0].name).toBe('Frontend')
    expect(teams[0].displayOrder).toBe(1)
  })

  test('addTeam generates a unique id', async () => {
    await addTeam({ organizationId: orgId, name: 'Team A', displayOrder: 0 })
    await addTeam({ organizationId: orgId, name: 'Team B', displayOrder: 1 })
    const teams = await listTeams(orgId)
    expect(teams).toHaveLength(2)
    expect(teams[0].id).not.toBe(teams[1].id)
  })

  test('addTeam rejects duplicate name', async () => {
    await addTeam({ organizationId: orgId, name: 'Backend', displayOrder: 0 })
    await expect(
      addTeam({ organizationId: orgId, name: 'Backend', displayOrder: 1 }),
    ).rejects.toThrow()
  })

  test('updateTeam changes name and displayOrder', async () => {
    await addTeam({ organizationId: orgId, name: 'Old Name', displayOrder: 0 })
    const teams = await listTeams(orgId)
    const teamId = teams[0].id

    await updateTeam({
      organizationId: orgId,
      id: teamId,
      name: 'New Name',
      displayOrder: 5,
      personalLimit: 3,
    })

    const updated = await listTeams(orgId)
    expect(updated[0].name).toBe('New Name')
    expect(updated[0].displayOrder).toBe(5)
    expect(updated[0].personalLimit).toBe(3)
  })

  test('deleteTeam removes the team', async () => {
    await addTeam({
      organizationId: orgId,
      name: 'To Delete',
      displayOrder: 0,
    })
    const teams = await listTeams(orgId)
    expect(teams).toHaveLength(1)

    await deleteTeam(orgId, teams[0].id)

    const remaining = await listTeams(orgId)
    expect(remaining).toHaveLength(0)
  })

  test('listTeams returns teams ordered by displayOrder then name', async () => {
    await addTeam({ organizationId: orgId, name: 'Zebra', displayOrder: 1 })
    await addTeam({ organizationId: orgId, name: 'Alpha', displayOrder: 1 })
    await addTeam({ organizationId: orgId, name: 'First', displayOrder: 0 })

    const teams = await listTeams(orgId)
    expect(teams.map((t) => t.name)).toEqual(['First', 'Alpha', 'Zebra'])
  })
})
