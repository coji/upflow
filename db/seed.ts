import { consola } from 'consola'
import 'dotenv/config'
import { nanoid } from 'nanoid'
import { db, sql } from '~/app/services/db.server'

async function seed() {
  // Clear existing data (child tables first for FK constraints)
  await db.deleteFrom('pullRequests').execute()
  await db.deleteFrom('companyGithubUsers').execute()
  await db.deleteFrom('repositories').execute()
  await db.deleteFrom('exportSettings').execute()
  await db.deleteFrom('organizationSettings').execute()
  await db.deleteFrom('integrations').execute()
  await db.deleteFrom('members').execute()
  await db.deleteFrom('organizations').execute()
  await db.deleteFrom('sessions').execute()
  await db.deleteFrom('accounts').execute()
  await db.deleteFrom('users').execute()

  const email = 'coji@techtalk.jp'

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

  // organization settings
  await db
    .insertInto('organizationSettings')
    .values({
      id: nanoid(),
      organizationId: organization.id,
      updatedAt: sql`CURRENT_TIMESTAMP`,
    })
    .execute()

  // export settings
  await db
    .insertInto('exportSettings')
    .values({
      id: nanoid(),
      organizationId: organization.id,
      sheetId: '',
      clientEmail: '',
      privateKey: '',
      updatedAt: sql`CURRENT_TIMESTAMP`,
    })
    .execute()

  // integration
  const integration = await db
    .insertInto('integrations')
    .values({
      id: nanoid(),
      provider: 'github',
      method: 'token',
      privateToken: process.env.INTEGRATION_PRIVATE_TOKEN,
      organizationId: organization.id,
    })
    .returningAll()
    .executeTakeFirstOrThrow()

  // repository
  const repo = await db
    .insertInto('repositories')
    .values({
      id: nanoid(),
      provider: 'github',
      owner: 'test',
      repo: 'test',
      integrationId: integration.id,
      organizationId: organization.id,
      updatedAt: sql`CURRENT_TIMESTAMP`,
    })
    .returningAll()
    .executeTakeFirstOrThrow()

  // pull requests
  for (const i of Array(10).keys()) {
    await db
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
  await db
    .insertInto('companyGithubUsers')
    .values({
      organizationId: organization.id,
      login: 'test_user',
      displayName: 'Test User',
      updatedAt: sql`CURRENT_TIMESTAMP`,
    })
    .execute()

  consola.info('Database has been seeded. 🌱')
}

seed().catch((e) => {
  consola.error(e)
  process.exit(1)
})
