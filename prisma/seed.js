const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient({ log: [{ emit: 'event', level: 'query' }] })
prisma.$on('query', async (e) => {
  console.log(`${e.query} ${e.params}`)
})

async function seed() {
  const email = 'coji@techtalk.jp'

  // cleanup the existing database
  await prisma.user.delete({ where: { email } }).catch((e) => {
    console.log(e)
  })
  // user
  const user = await prisma.user.create({
    data: {
      email,
      name: 'Coji Mizoguchi',
      password: {
        create: {
          hash: await bcrypt.hash('techtalk', 10)
        }
      }
    }
  })

  // company
  const company = await prisma.company.create({
    data: {
      name: 'TechTalk'
    }
  })

  await prisma.companyUser.create({
    data: {
      company: { connect: { id: company.id } },
      user: { connect: { id: user.id } },
      role: 'admin'
    }
  })

  // team
  await prisma.team.create({
    data: {
      name: 'frontend',
      company: { connect: { id: company.id } },
      users: { connect: { id: user.id } }
    }
  })

  // integration
  const integration = await prisma.integration.create({
    data: {
      provider: process.env.INTEGRATION_PROVIDER,
      method: process.env.INTEGRATION_METHOD,
      privateToken: process.env.INTEGRATION_PRIVATE_TOKEN,
      company: { connect: { id: company.id } }
    }
  })

  // respository
  await prisma.repository.create({
    data: {
      provider: process.env.INTEGRATION_PROVIDER,
      projectId: process.env.REPOSITORY_PROJECT_ID,
      integration: { connect: { id: integration.id } },
      company: { connect: { id: company.id } }
    }
  })

  console.log(`Database has been seeded. 🌱`)
}

seed()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
