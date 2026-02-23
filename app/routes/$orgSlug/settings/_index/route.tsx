import { zx } from '@coji/zodix/v4'
import { match } from 'ts-pattern'
import { Stack } from '~/app/components/ui'
import { requireOrgAdmin } from '~/app/libs/auth.server'
import type { Route } from './+types/route'
import {
  DeleteOrganization,
  ExportSettings,
  IntegrationSettings,
  OrganizationSettings,
  Recalculate,
} from './forms'
import {
  deleteOrganizationAction,
  exportSettingsAction,
  integrationSettingsAction,
  organizationSettingsAction,
} from './forms/actions.server'
import {
  createDefaultOrganizationSetting,
  getExportSetting,
  getIntegration,
  getOrganization,
  getOrganizationSetting,
} from './functions/queries.server'
import { INTENTS, intentsSchema } from './types'

export const handle = {
  breadcrumb: () => ({
    label: 'Settings',
  }),
}

export const loader = async ({ request, params }: Route.LoaderArgs) => {
  const { organization: orgContext } = await requireOrgAdmin(
    request,
    params.orgSlug,
  )
  const organization = await getOrganization(orgContext.id)
  if (!organization) {
    throw new Response('Organization not found', { status: 404 })
  }
  const organizationSetting =
    (await getOrganizationSetting(orgContext.id)) ??
    (await createDefaultOrganizationSetting(orgContext.id))

  const exportSetting = await getExportSetting(orgContext.id)
  const integration = await getIntegration(orgContext.id)
  return { organization, organizationSetting, exportSetting, integration }
}

export const action = async ({
  request,
  params,
  context,
  ...rest
}: Route.ActionArgs) => {
  const { intent } = await zx.parseForm(await request.clone().formData(), {
    intent: intentsSchema,
  })

  return await match(intent)
    .with(INTENTS.organizationSettings, () =>
      organizationSettingsAction({ request, params, context, ...rest }),
    )
    .with(INTENTS.integrationSettings, () =>
      integrationSettingsAction({
        request,
        params,
        context,
        ...rest,
      }),
    )
    .with(INTENTS.exportSettings, () =>
      exportSettingsAction({ request, params, context, ...rest }),
    )
    .with(INTENTS.deleteOrganization, () =>
      deleteOrganizationAction({ request, params, context, ...rest }),
    )
    .exhaustive()
}

export default function OrganizationSettingsPage({
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
      <Recalculate />
      <DeleteOrganization organization={organization} />
    </Stack>
  )
}
