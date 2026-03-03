import consola from 'consola'
import invariant from 'tiny-invariant'
import type { OrganizationId } from '~/app/services/tenant-db.server'
import { getOrganization } from '~/batch/db'
import { allConfigs } from '../config'
import { createProvider } from '../provider'

interface BackfillCommandProps {
  organizationId?: string
  files?: boolean
}

export async function backfillCommand(props: BackfillCommandProps) {
  if (!props.organizationId) {
    consola.error('Error: organization id should specify')
    consola.info(
      (await allConfigs())
        .map((o) => `${o.organizationName}\t${o.organizationId}`)
        .join('\n'),
    )
    return
  }

  const orgId = props.organizationId as OrganizationId
  const organization = await getOrganization(orgId)
  invariant(organization.integration, 'integration should related')

  const provider = createProvider(organization.integration)
  invariant(provider, `unknown provider: ${organization.integration.provider}`)

  for (const repository of organization.repositories) {
    await provider.backfill(orgId, repository, { files: props.files })
  }

  consola.success('backfill completed. Run `upsert` to apply changes.')
}
