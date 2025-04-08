import { consola } from 'consola'
import { config } from 'dotenv'
import { nanoid } from 'nanoid'
import { db, sql } from '~/app/services/db.server'
config()

async function seed() {
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

  // company
  const company = await db
    .insertInto('companies')
    .values({
      id: 'techtalk',
      name: 'TechTalk',
      updatedAt: sql`CURRENT_TIMESTAMP`,
    })
    .returningAll()
    .executeTakeFirstOrThrow()

  // integration
  const integration = await db
    .insertInto('integrations')
    .values({
      id: nanoid(),
      provider: 'github',
      method: 'token',
      privateToken: process.env.INTEGRATION_PRIVATE_TOKEN,
      companyId: company.id,
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
      companyId: company.id,
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
      companyId: company.id,
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
