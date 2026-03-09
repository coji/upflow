import consola from 'consola'
import { requireOrganizationWithProvider } from './helpers'

interface BackfillCommandProps {
  organizationId?: string
  files?: boolean
}

export async function backfillCommand(props: BackfillCommandProps) {
  const result = await requireOrganizationWithProvider(props.organizationId)
  if (!result) return

  const { orgId, organization, provider } = result

  for (const repository of organization.repositories) {
    await provider.backfill(orgId, repository, { files: props.files })
  }

  consola.success('backfill completed. Run `upsert` to apply changes.')
}
