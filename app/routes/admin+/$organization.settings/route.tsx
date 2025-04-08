import { match } from 'ts-pattern'
import { z } from 'zod'
import { zx } from 'zodix'
import { Stack } from '~/app/components/ui'
import type { Route } from './+types/route'
import {
  DeleteOrganization,
  ExportSettings,
  IntegrationSettings,
  OrganizationSettings,
} from './forms'
import {
  companySettingsAction,
  deleteCompanyAction,
  exportSettingsAction,
  integrationSettingsAction,
} from './forms/actions.server'
import {
  getExportSetting,
  getIntegration,
  getOrganization,
  getOrganizationSetting,
} from './functions/queries.server'
import { INTENTS, intentsSchema } from './types'

export const loader = async ({ params }: Route.LoaderArgs) => {
  const { organization: organizationId } = zx.parseParams(params, {
    organization: z.string(),
  })
  const organization = await getOrganization(organizationId)
  if (!organization) {
    throw new Response('Organization not found', { status: 404 })
  }
  const organizationSetting = await getOrganizationSetting(organizationId)
  if (!organizationSetting) {
    throw new Response('Organization setting not found', { status: 404 })
  }

  const exportSetting = await getExportSetting(organizationId)
  const integration = await getIntegration(organizationId)
  return { organization, organizationSetting, exportSetting, integration }
}

export const action = async ({
  request,
  params,
  context,
}: Route.ActionArgs) => {
  const { intent } = await zx.parseForm(await request.clone().formData(), {
    intent: intentsSchema,
  })

  return await match(intent)
    .with(INTENTS.organizationSettings, () =>
      companySettingsAction({ request, params, context }),
    )
    .with(INTENTS.integrationSettings, () =>
      integrationSettingsAction({
        request,
        params,
        context,
      }),
    )
    .with(INTENTS.exportSettings, () =>
      exportSettingsAction({ request, params, context }),
    )
    .with(INTENTS.deleteOrganization, () =>
      deleteCompanyAction({ request, params, context }),
    )
    .exhaustive()
}

export default function CompanySettingsPage({
  loaderData: { organization, organizationSetting, exportSetting, integration },
}: Route.ComponentProps) {
  return (
    <Stack>
      <OrganizationSettings
        organization={organization}
        organizationSetting={organizationSetting}
      />
      <IntegrationSettings integration={integration} />
      <ExportSettings exportSetting={exportSetting} />
      <DeleteOrganization organization={organization} />
    </Stack>
  )
}
