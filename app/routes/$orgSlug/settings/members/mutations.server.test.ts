import SQLite from 'better-sqlite3'
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeEach, describe, expect, test, vi } from 'vitest'
import type { MemberRole } from '~/app/libs/member-role'
import { closeDb } from '~/app/services/db.server'
import { toOrgId } from '~/app/types/organization'
import { changeMemberRole, removeMember } from './mutations.server'

const testDir = path.join(tmpdir(), `members-mutations-${Date.now()}`)
mkdirSync(testDir, { recursive: true })
const testDbPath = path.join(testDir, 'data.db')
writeFileSync(testDbPath, '')
const rawInit = new SQLite(testDbPath)
rawInit.exec(`
  CREATE TABLE members (
    id text NOT NULL PRIMARY KEY, organization_id text NOT NULL,
    user_id text NOT NULL, role text NOT NULL
  );
`)
rawInit.close()
vi.stubEnv('UPFLOW_DATA_DIR', path.dirname(testDbPath))

const orgId = toOrgId('org-1')

const seed = (rows: Array<[id: string, role: MemberRole]>) => {
  const raw = new SQLite(testDbPath)
  raw.exec('DELETE FROM members')
  const insert = raw.prepare(
    'INSERT INTO members (id, organization_id, user_id, role) VALUES (?, ?, ?, ?)',
  )
  for (const [id, role] of rows) insert.run(id, orgId, `user-${id}`, role)
  raw.close()
}

const roleOf = (id: string) => {
  const raw = new SQLite(testDbPath)
  const row = raw.prepare('SELECT role FROM members WHERE id = ?').get(id) as
    | { role: string }
    | undefined
  raw.close()
  return row?.role
}

const owner = { id: 'owner-1', role: 'owner' as const }
const admin = { id: 'admin-1', role: 'admin' as const }

describe('members mutations', () => {
  afterAll(async () => {
    await closeDb()
    vi.unstubAllEnvs()
  })

  beforeEach(async () => {
    await closeDb()
    seed([
      ['owner-1', 'owner'],
      ['owner-2', 'owner'],
      ['admin-1', 'admin'],
      ['member-1', 'member'],
    ])
  })

  describe('changeMemberRole', () => {
    test('admin cannot grant the owner role', async () => {
      await expect(
        changeMemberRole('member-1', orgId, 'owner', admin),
      ).rejects.toThrow('Only owners can grant the owner role')
      expect(roleOf('member-1')).toBe('member')
    })

    test("admin cannot change an owner's role", async () => {
      await expect(
        changeMemberRole('owner-2', orgId, 'member', admin),
      ).rejects.toThrow("Only owners can change an owner's role")
      expect(roleOf('owner-2')).toBe('owner')
    })

    test('admin can change roles between admin and member', async () => {
      await changeMemberRole('member-1', orgId, 'admin', admin)
      expect(roleOf('member-1')).toBe('admin')
    })

    test('owner can grant the owner role', async () => {
      await changeMemberRole('member-1', orgId, 'owner', owner)
      expect(roleOf('member-1')).toBe('owner')
    })

    test('owner can demote another owner', async () => {
      await changeMemberRole('owner-2', orgId, 'admin', owner)
      expect(roleOf('owner-2')).toBe('admin')
    })

    test('cannot change own role', async () => {
      await expect(
        changeMemberRole('owner-1', orgId, 'admin', owner),
      ).rejects.toThrow('Cannot change your own role')
    })
  })

  describe('removeMember', () => {
    test('admin cannot remove an owner', async () => {
      await expect(removeMember('owner-2', orgId, admin)).rejects.toThrow(
        'Only owners can remove an owner',
      )
      expect(roleOf('owner-2')).toBe('owner')
    })

    test('admin can remove a member', async () => {
      await removeMember('member-1', orgId, admin)
      expect(roleOf('member-1')).toBeUndefined()
    })

    test('owner can remove another owner', async () => {
      await removeMember('owner-2', orgId, owner)
      expect(roleOf('owner-2')).toBeUndefined()
    })
  })
})
