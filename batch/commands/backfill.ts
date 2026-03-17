import consola from 'consola'
import invariant from 'tiny-invariant'
import { backfillRepo } from '~/batch/github/backfill-repo'
import { requireOrganization } from './helpers'
import { shutdown } from './shutdown'

interface BackfillCommandProps {
  organizationId?: string
  files?: boolean
}

export async function backfillCommand(props: BackfillCommandProps) {
  const result = await requireOrganization(props.organizationId)
  if (!result) return

  const { orgId, organization } = result
  invariant(organization.integration, 'integration should related')

  for (const repository of organization.repositories) {
    await backfillRepo(orgId, repository, organization.integration, {
      files: props.files,
    })
  }

  consola.success('backfill completed. Run `recalculate` to apply changes.')
  await shutdown()
}
