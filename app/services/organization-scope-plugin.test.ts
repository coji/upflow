import SQLite from 'better-sqlite3'
import {
  CamelCasePlugin,
  Kysely,
  ParseJSONResultsPlugin,
  SqliteDialect,
} from 'kysely'
import { describe, expect, it } from 'vitest'
import { OrganizationScopePlugin } from './organization-scope-plugin'
import type * as DB from './type'

/**
 * Create an in-memory Kysely instance with the same plugin stack as production,
 * but with OrganizationScopePlugin added via withPlugin().
 */
function createTestDb() {
  const database = new SQLite(':memory:')
  return new Kysely<DB.DB>({
    dialect: new SqliteDialect({ database }),
    plugins: [new ParseJSONResultsPlugin(), new CamelCasePlugin()],
  })
}

describe('OrganizationScopePlugin', () => {
  const orgId = 'org-test-123'

  it('adds WHERE organization_id to SELECT on scoped table', () => {
    const db = createTestDb()
    const scopedDb = db.withPlugin(new OrganizationScopePlugin(orgId))

    const query = scopedDb.selectFrom('integrations').selectAll().compile()

    expect(query.sql).toContain('where')
    expect(query.sql).toContain('"organization_id" = ?')
    expect(query.parameters).toContain(orgId)
  })

  it('adds WHERE organization_id to UPDATE on scoped table', () => {
    const db = createTestDb()
    const scopedDb = db.withPlugin(new OrganizationScopePlugin(orgId))

    const query = scopedDb
      .updateTable('integrations')
      .set({ provider: 'github' })
      .where('id', '=', 'int-1')
      .compile()

    expect(query.sql).toContain('"organization_id" = ?')
    expect(query.parameters).toContain(orgId)
    // Should also contain the user-specified WHERE
    expect(query.parameters).toContain('int-1')
  })

  it('adds WHERE organization_id to DELETE on scoped table', () => {
    const db = createTestDb()
    const scopedDb = db.withPlugin(new OrganizationScopePlugin(orgId))

    const query = scopedDb
      .deleteFrom('members')
      .where('id', '=', 'mem-1')
      .compile()

    expect(query.sql).toContain('"organization_id" = ?')
    expect(query.parameters).toContain(orgId)
    expect(query.parameters).toContain('mem-1')
  })

  it('does NOT add WHERE to non-scoped tables', () => {
    const db = createTestDb()
    const scopedDb = db.withPlugin(new OrganizationScopePlugin(orgId))

    const query = scopedDb.selectFrom('users').selectAll().compile()

    expect(query.sql).not.toContain('organization_id')
    expect(query.parameters).not.toContain(orgId)
  })

  it('does NOT add WHERE to organizations table', () => {
    const db = createTestDb()
    const scopedDb = db.withPlugin(new OrganizationScopePlugin(orgId))

    const query = scopedDb.selectFrom('organizations').selectAll().compile()

    expect(query.sql).not.toContain('organization_id')
  })

  it('does NOT modify INSERT queries', () => {
    const db = createTestDb()
    const scopedDb = db.withPlugin(new OrganizationScopePlugin(orgId))

    const query = scopedDb
      .insertInto('integrations')
      .values({
        id: 'int-1',
        provider: 'github',
        method: 'token',
        organizationId: orgId,
        privateToken: 'secret',
      })
      .compile()

    // INSERT should not have an injected WHERE (INSERTs don't have WHERE)
    // The organizationId should only appear in the VALUES
    const orgIdCount = query.parameters.filter((p) => p === orgId).length
    expect(orgIdCount).toBe(1) // only from the VALUES, not an extra WHERE
  })

  it('works with all scoped tables', () => {
    const db = createTestDb()
    const scopedDb = db.withPlugin(new OrganizationScopePlugin(orgId))

    const tables = [
      'companyGithubUsers',
      'exportSettings',
      'integrations',
      'invitations',
      'members',
      'organizationSettings',
      'repositories',
      'teams',
    ] as const

    for (const table of tables) {
      const query = scopedDb.selectFrom(table).selectAll().compile()

      expect(query.sql).toContain('"organization_id" = ?')
      expect(query.parameters).toContain(orgId)
    }
  })

  it('ANDs with existing WHERE clause', () => {
    const db = createTestDb()
    const scopedDb = db.withPlugin(new OrganizationScopePlugin(orgId))

    const query = scopedDb
      .selectFrom('repositories')
      .selectAll()
      .where('owner', '=', 'acme')
      .compile()

    // Should contain both conditions
    expect(query.sql).toContain('"owner" = ?')
    expect(query.sql).toContain('"organization_id" = ?')
    expect(query.parameters).toContain('acme')
    expect(query.parameters).toContain(orgId)
  })
})
