import SQLite from 'better-sqlite3'
import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, test } from 'vitest'

const migrationsDir = new URL('./migrations/shared/', import.meta.url)
const migrationName = '20261109054802_better_auth_1_7.sql'

describe('Better Auth 1.7 migration', () => {
  test('preserves existing memberships and initializes team counters', () => {
    const database = new SQLite(':memory:')
    try {
      for (const name of readdirSync(migrationsDir).sort()) {
        if (!name.endsWith('.sql') || name >= migrationName) continue
        database.exec(readFileSync(new URL(name, migrationsDir), 'utf8'))
      }
      database.exec(`
        INSERT INTO users (id, name, email, email_verified, role, updated_at)
        VALUES ('u1', 'One', 'one@example.com', 1, 'user', CURRENT_TIMESTAMP),
               ('u2', 'Two', 'two@example.com', 1, 'user', CURRENT_TIMESTAMP);
        INSERT INTO organizations (id, name, slug) VALUES ('o1', 'Example', 'example');
        INSERT INTO teams (id, name, organization_id, created_at)
        VALUES ('t1', 'Populated', 'o1', CURRENT_TIMESTAMP),
               ('t2', 'Empty', 'o1', CURRENT_TIMESTAMP);
        INSERT INTO team_members (id, team_id, user_id)
        VALUES ('m1', 't1', 'u1'), ('m2', 't1', 'u2');
      `)
      database.exec(readFileSync(new URL(migrationName, migrationsDir), 'utf8'))

      expect(
        database
          .prepare('SELECT id, member_count FROM teams ORDER BY id')
          .all(),
      ).toEqual([
        { id: 't1', member_count: 2 },
        { id: 't2', member_count: 0 },
      ])
      expect(
        database
          .prepare('SELECT id, membership_key FROM team_members ORDER BY id')
          .all(),
      ).toEqual([
        { id: 'm1', membership_key: null },
        { id: 'm2', membership_key: null },
      ])
      expect(database.pragma('foreign_key_check')).toEqual([])
      database
        .prepare('UPDATE team_members SET membership_key = ? WHERE id = ?')
        .run('unique-key', 'm1')
      expect(() =>
        database
          .prepare('UPDATE team_members SET membership_key = ? WHERE id = ?')
          .run('unique-key', 'm2'),
      ).toThrow(/UNIQUE/)
    } finally {
      database.close()
    }
  })
})
