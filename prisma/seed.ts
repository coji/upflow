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
      displayName: 'Coji Mizoguchi',
      locale: 'ja',
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

  // company user
  await db
    .insertInto('companyUsers')
    .values({
      companyId: company.id,
      userId: user.id,
      role: 'admin',
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
      companyId: company.id,
    })
    .returningAll()
    .executeTakeFirstOrThrow()

  // repository
  await db
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
    .execute()

  console.log('Database has been seeded. 🌱')
}

seed().catch((e) => {
  console.error(e)
  process.exit(1)
})
