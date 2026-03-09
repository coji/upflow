import consola from 'consola'
import invariant from 'tiny-invariant'
import type { OrganizationId } from '~/app/types/organization'
import { getOrganization } from '~/batch/db'
import { allConfigs } from '../config'
import { createProvider } from '../provider'

export async function requireOrganization(organizationId: string | undefined) {
  if (!organizationId) {
    consola.error('Error: organization id should specify')
    consola.info(
      (await allConfigs())
        .map((o) => `${o.organizationName}\t${o.organizationId}`)
        .join('\n'),
    )
    return undefined
  }
  const orgId = organizationId as OrganizationId
  const organization = await getOrganization(orgId)
  return { orgId, organization }
}

export async function requireOrganizationWithProvider(
  organizationId: string | undefined,
) {
  const result = await requireOrganization(organizationId)
  if (!result) return undefined
  const { orgId, organization } = result
  invariant(organization.integration, 'integration should related')
  const provider = createProvider(organization.integration)
  invariant(provider, `unknown provider: ${organization.integration.provider}`)
  return { orgId, organization, provider }
}
