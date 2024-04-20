import { listAllCompanies } from '~/batch/db'

export interface Config {
  companyId: string
  companyName: string
  integraiton: {
    id: string
    provider: string
    method: string
    privateToken: string | null
  } | null
  repositories: { id: string }[]
}

export const allConfigs = async () => {
  const configs = (await listAllCompanies()).map((company) => {
    return {
      companyId: company.id,
      companyName: company.name,
      integraiton: company.integration,
      repositories: company.repositories.map((repo) => ({ id: repo.id })),
    } as Config
  })
  return configs
}

export const loadConfig = async (companyId: string) => {
  const configs = await allConfigs()
  return configs.find((config) => config.companyId === companyId)
}
