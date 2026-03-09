import type { OrganizationId } from '~/app/types/organization'
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
