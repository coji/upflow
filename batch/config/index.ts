import { prisma } from '~/app/services/db.server'

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
    },
  ]
}

export const allConfigs = async () => {
  const configs = (
    await prisma.company.findMany({
      include: {
        integration: {
          select: {
            id: true,
            provider: true,
            method: true,
            privateToken: true,
          },
        },
        repositories: { select: { id: true } },
      },
    })
  ).map((company) => {
    return {
      companyId: company.id,
      companyName: company.name,
      integraiton: company.integration,
      repositories: company.repositories,
    } as Config
  })
  return configs
}

export const loadConfig = async (companyId: string) => {
  const configs = await allConfigs()
  return configs.find((config) => config.companyId === companyId)
}
