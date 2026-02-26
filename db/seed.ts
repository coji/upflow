import { consola } from 'consola'
import 'dotenv/config'
import { nanoid } from 'nanoid'
import { copyFileSync } from 'node:fs'
import { db, sql } from '~/app/services/db.server'
import {
  createTenantDb,
  getTenantDb,
  getTenantDbPath,
} from '~/app/services/tenant-db.server'

async function seed() {
  // Clear existing shared data (child tables first for FK constraints)
  await db.deleteFrom('members').execute()
  await db.deleteFrom('organizations').execute()
  await db.deleteFrom('sessions').execute()
  await db.deleteFrom('accounts').execute()
  await db.deleteFrom('users').execute()

  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com'

  // user
  const user = await db
    .insertInto('users')
    .values({
      id: nanoid(),
      email,
      name: 'Coji Mizoguchi',
      emailVerified: sql`CURRENT_TIMESTAMP`,
      image: 'https://avatars.githubusercontent.com/u/12345678?v=4',
      role: 'admin',
      updatedAt: sql`CURRENT_TIMESTAMP`,
    })
    .returningAll()
    .executeTakeFirstOrThrow()

  // organization
  const organization = await db
    .insertInto('organizations')
    .values({
      id: nanoid(),
      name: 'TechTalk',
      slug: 'techtalk',
    })
    .returningAll()
    .executeTakeFirstOrThrow()

  // member user (non-admin, for testing role-based UI)
  const memberUser = await db
    .insertInto('users')
    .values({
      id: nanoid(),
      email: process.env.SEED_MEMBER_EMAIL ?? 'member@example.com',
      name: 'Member User',
      emailVerified: sql`CURRENT_TIMESTAMP`,
      image: null,
      role: 'user',
      updatedAt: sql`CURRENT_TIMESTAMP`,
    })
    .returningAll()
    .executeTakeFirstOrThrow()

  // member (owner)
  await db
    .insertInto('members')
    .values({
      id: nanoid(),
      organizationId: organization.id,
      userId: user.id,
      role: 'owner',
      createdAt: sql`CURRENT_TIMESTAMP`,
    })
    .execute()

  // member (member role)
  await db
    .insertInto('members')
    .values({
      id: nanoid(),
      organizationId: organization.id,
      userId: memberUser.id,
      role: 'member',
      createdAt: sql`CURRENT_TIMESTAMP`,
    })
    .execute()

  // --- Tenant DB ---
  // Create tenant DB file and apply migrations
  const tenantDbPath = getTenantDbPath(organization.id)
  consola.info(`Creating tenant DB at ${tenantDbPath}...`)
  createTenantDb(organization.id)

  const tenantDb = getTenantDb(organization.id)

  // organization settings
  await tenantDb
    .insertInto('organizationSettings')
    .values({
      id: nanoid(),
      updatedAt: sql`CURRENT_TIMESTAMP`,
    })
    .execute()

  // export settings
  await tenantDb
    .insertInto('exportSettings')
    .values({
      id: nanoid(),
      sheetId: '',
      clientEmail: '',
      privateKey: '',
      updatedAt: sql`CURRENT_TIMESTAMP`,
    })
    .execute()

  // integration
  const integration = await tenantDb
    .insertInto('integrations')
    .values({
      id: nanoid(),
      provider: 'github',
      method: 'token',
      privateToken: process.env.INTEGRATION_PRIVATE_TOKEN ?? null,
    })
    .returningAll()
    .executeTakeFirstOrThrow()

  // repository
  const repo = await tenantDb
    .insertInto('repositories')
    .values({
      id: nanoid(),
      provider: 'github',
      owner: 'test',
      repo: 'test',
      integrationId: integration.id,
      updatedAt: sql`CURRENT_TIMESTAMP`,
    })
    .returningAll()
    .executeTakeFirstOrThrow()

  // pull requests
  for (const i of Array(10).keys()) {
    await tenantDb
      .insertInto('pullRequests')
      .values({
        repo: 'test',
        number: i + 1,
        title: `Test PR ${i + 1}`,
        author: 'test_user',
        url: 'https://example.com',
        pullRequestCreatedAt: sql`CURRENT_TIMESTAMP`,
        state: 'open',
        repositoryId: repo.id,
        sourceBranch: 'main',
        targetBranch: 'develop',
      })
      .execute()
  }

  // company github users
  await tenantDb
    .insertInto('companyGithubUsers')
    .values({
      login: 'test_user',
      displayName: 'Test User',
      updatedAt: sql`CURRENT_TIMESTAMP`,
    })
    .execute()

  // Copy tenant DB for type generation (used by db:generate:tenant)
  copyFileSync(tenantDbPath, './data/tenant_seed.db')

  consola.info('Database has been seeded. 🌱')
}

seed().catch((e) => {
  consola.error(e)
  process.exit(1)
})
