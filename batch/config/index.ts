import type { OrganizationId } from '~/app/services/tenant-db.server'
import { listAllOrganizations } from '~/batch/db'

export interface Config {
  organizationId: OrganizationId
  organizationName: string
  integration: {
    id: string
    provider: string
    method: string
    privateToken: string | null
  } | null
  repositories: { id: string }[]
}

export const allConfigs = async () => {
  const organizations = await listAllOrganizations()
  const configs = organizations.map((org) => {
    return {
      organizationId: org.id as OrganizationId,
      organizationName: org.name,
      integration: org.integration,
      repositories: org.repositories.map((repo) => ({ id: repo.id })),
    } satisfies Config
  })
  return configs
}

export const loadConfig = async (organizationId: OrganizationId) => {
  const configs = await allConfigs()
  return configs.find((config) => config.organizationId === organizationId)
}
