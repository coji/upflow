import { PrismaClient } from '@prisma/client'
import { nanoid } from 'nanoid'

const prisma = new PrismaClient({ log: [{ emit: 'event', level: 'query' }] })
prisma.$on('query', (e) => {
  console.log(`${e.query} ${e.params}`)
})

async function seed() {
  const email = 'coji@techtalk.jp'

  // user
  const user = await prisma.user.create({
    data: {
      email,
      displayName: 'Coji Mizoguchi',
      locale: 'ja',
      role: 'admin',
    },
  })

  // company
  const company = await prisma.company.create({
    data: { id: 'techtalk', name: 'TechTalk' },
  })

  // company user
  await prisma.companyUser.create({
    data: {
      company: { connect: { id: company.id } },
      user: { connect: { id: user.id } },
      role: 'admin',
    },
  })

  // integration
  const integration = await prisma.integration.create({
    data: {
      provider: 'github',
      method: 'token',
      privateToken: process.env.INTEGRATION_PRIVATE_TOKEN,
      company: { connect: { id: company.id } },
    },
  })

  // repository
  await prisma.repository.create({
    data: {
      id: nanoid(),
      provider: 'github',
      owner: 'test',
      repo: 'test',
      integration: { connect: { id: integration.id } },
      company: { connect: { id: company.id } },
    },
  })

  console.log('Database has been seeded. 🌱')
}

seed()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
