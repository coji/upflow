import { prisma } from '~/app/db.server'

export interface Config {
  companyId: string
  companyName: string
  integraiton: {
    id: string
    provider: string
    method: string
    privateToken: string | null
  } | null
  repositories: [
    {
      id: string
      projectId: string
    }
  ]
}

export const allRepositories = async () => {
  const repositories = await (
    await prisma.company.findMany({
      include: {
        integration: { select: { id: true, provider: true, method: true, privateToken: true } },
        repositories: { select: { id: true, projectId: true } }
      }
    })
  ).map((company) => {
    return {
      companyId: company.id,
      companyName: company.name,
      integraiton: company.integration,
      repositories: company.repositories
    } as Config
  })
  return repositories
}

export const loadConfig = async (companyId: string) => {
  const repositories = await allRepositories()
  return repositories.find((repo) => repo.companyId === companyId)
}
