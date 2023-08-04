import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient({ log: [{ emit: 'event', level: 'query' }] })
prisma.$on('query', async (e) => {
  console.log(`${e.query} ${e.params}`)
})

/**
 * cleanup existing database
 * @param string email
 */
const cleanup = async (email) => {
  await prisma.user.delete({ where: { email } }).catch((e) => console.log(e))

  const repository = await prisma.repository.findFirst({
    where: {
      provider: process.env.INTEGRATION_PROVIDER,
      projectId: process.env.REPOSITORY_PROJECT_ID,
    },
  })
  if (!repository) return {}

  const company = await prisma.company.findFirst({
    where: { id: repository.companyId },
  })
  if (!company) return { repository: repository.id }
  await prisma.company.delete({ where: { id: company.id } }).catch((e) => console.log(e))

  return {
    companyId: company?.id,
    repositoryId: repository?.id,
  }
}

async function seed() {
  const email = 'coji@techtalk.jp'
  const { companyId, repositoryId } = await cleanup(email)

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
    data: {
      id: companyId,
      name: 'TechTalk',
    },
  })

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
      provider: process.env.INTEGRATION_PROVIDER,
      method: process.env.INTEGRATION_METHOD,
      privateToken: process.env.INTEGRATION_PRIVATE_TOKEN,
      company: { connect: { id: company.id } },
    },
  })

  // repository
  await prisma.repository.create({
    data: {
      id: repositoryId,
      provider: process.env.INTEGRATION_PROVIDER,
      projectId: process.env.REPOSITORY_PROJECT_ID,
      integration: { connect: { id: integration.id } },
      company: { connect: { id: company.id } },
    },
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
