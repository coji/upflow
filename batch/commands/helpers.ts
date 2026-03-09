import consola from 'consola'
import type { OrganizationId } from '~/app/types/organization'
import { getOrganization } from '~/batch/db'
import { allConfigs } from '../config'

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
  if (!organization) {
    consola.error(`Organization not found: ${organizationId}`)
    return undefined
  }
  return { orgId, organization }
}
