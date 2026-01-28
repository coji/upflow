import consola from 'consola'
import invariant from 'tiny-invariant'
import { getOrganization } from '~/batch/db'
import { allConfigs } from '../config'
import { createProvider } from '../provider/index'
import { analyzeAndUpsert } from '../usecases/analyze-and-upsert'

interface UpsertCommandProps {
  organizationId?: string
}

export async function upsertCommand({ organizationId }: UpsertCommandProps) {
  if (!organizationId) {
    consola.error('config should specified')
    consola.info(
      (await allConfigs())
        .map((o) => `${o.organizationName}\t${o.organizationId}`)
        .join('\n'),
    )
    return
  }

  const organization = await getOrganization(organizationId)
  invariant(organization.integration, 'integration should related')
  invariant(
    organization.organizationSetting,
    'organization setting should related',
  )

  const provider = createProvider(organization.integration)
  invariant(provider, `unknown provider ${organization.integration.provider}`)

  await analyzeAndUpsert({
    organization: {
      ...organization,
      organizationSetting: organization.organizationSetting,
    },
    provider,
  })
}
