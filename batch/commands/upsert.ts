import invariant from 'tiny-invariant'
import { analyzeAndUpsert } from '../usecases/analyze-and-upsert'
import { requireOrganization } from './helpers'

interface UpsertCommandProps {
  organizationId?: string
}

export async function upsertCommand({ organizationId }: UpsertCommandProps) {
  const result = await requireOrganization(organizationId)
  if (!result) return

  const { orgId, organization } = result
  invariant(
    organization.organizationSetting,
    'organization setting should related',
  )

  await analyzeAndUpsert({
    organization: {
      id: orgId,
      organizationSetting: organization.organizationSetting,
      repositories: organization.repositories,
      exportSetting: organization.exportSetting,
    },
  })
}
