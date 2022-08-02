const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function seed() {
  const email = 'coji@techtalk.jp'

  // cleanup the existing database
  await prisma.user.delete({ where: { email } }).catch(() => {
    // no worries if it doesn't exist yet
  })

  const hashedPassword = await bcrypt.hash('techtalk', 10)
  const user = await prisma.user.create({
    data: {
      email,
      password: {
        create: {
          hash: hashedPassword
        }
      }
    }
  })

  const company = await prisma.company.create({
    data: {
      name: 'TechTalk'
    }
  })

  await prisma.companyUser.create({
    data: {
      companyId: company.id,
      userId: user.id,
      role: 'admin'
    }
  })

  const integration = await prisma.repositoryIntegration.create({
    data: {
      companyId: company.id,
      provider: process.env.INTEGRATION_PROVIDER,
      method: process.env.INTEGRATION_METHOD,
      privateToken: process.env.INTEGRATION_PRIVATE_TOKEN
    }
  })

  await prisma.repository.create({
    data: {
      integrationId: integration.id,
      provider: process.env.INTEGRATION_PROVIDER,
      projectId: process.env.REPOSITORY_PROJECT_ID
    }
  })

  await prisma.team.create({
    data: {
      companyId: company.id
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
