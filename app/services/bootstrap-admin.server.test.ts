import SQLite from 'better-sqlite3'
import { afterEach, describe, expect, test } from 'vitest'
import { CamelCasePlugin, Kysely, SqliteDialect } from 'kysely'
import type { DB } from '~/app/services/type'
import { claimInitialSuperAdmin } from './bootstrap-admin.server'

let sqlite: SQLite.Database | undefined
let database: Kysely<DB> | undefined

afterEach(async () => {
  await database?.destroy()
  database = undefined
  sqlite = undefined
})

describe('claimInitialSuperAdmin', () => {
  test('promotes only the user who atomically claims the bootstrap marker', async () => {
    sqlite = new SQLite(':memory:')
    sqlite.exec(`
      CREATE TABLE bootstrap_markers (key TEXT PRIMARY KEY, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE users (id TEXT PRIMARY KEY, role TEXT);
      INSERT INTO users (id, role) VALUES ('first', 'user'), ('second', 'user');
    `)
    database = new Kysely<DB>({
      dialect: new SqliteDialect({ database: sqlite }),
      plugins: [new CamelCasePlugin()],
    })

    await expect(claimInitialSuperAdmin(database, 'first')).resolves.toBe(true)
    await expect(claimInitialSuperAdmin(database, 'second')).resolves.toBe(
      false,
    )

    const users = await database
      .selectFrom('users')
      .select(['id', 'role'])
      .orderBy('id')
      .execute()
    expect(users).toEqual([
      { id: 'first', role: 'admin' },
      { id: 'second', role: 'user' },
    ])
  })

  test('releases the bootstrap marker when the target user does not exist', async () => {
    sqlite = new SQLite(':memory:')
    sqlite.exec(`
      CREATE TABLE bootstrap_markers (key TEXT PRIMARY KEY, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE users (id TEXT PRIMARY KEY, role TEXT);
      INSERT INTO users (id, role) VALUES ('real-user', 'user');
    `)
    database = new Kysely<DB>({
      dialect: new SqliteDialect({ database: sqlite }),
      plugins: [new CamelCasePlugin()],
    })

    await expect(claimInitialSuperAdmin(database, 'missing')).resolves.toBe(
      false,
    )
    await expect(claimInitialSuperAdmin(database, 'real-user')).resolves.toBe(
      true,
    )
  })
})
