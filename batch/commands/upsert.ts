import invariant from 'tiny-invariant'
import { analyzeAndUpsert } from '../usecases/analyze-and-upsert'
import { requireOrganizationWithProvider } from './helpers'

interface UpsertCommandProps {
  organizationId?: string
}

export async function upsertCommand({ organizationId }: UpsertCommandProps) {
  const result = await requireOrganizationWithProvider(organizationId)
  if (!result) return

  const { orgId, organization, provider } = result
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
    provider,
  })
}
