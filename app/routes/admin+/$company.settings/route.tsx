import { match } from 'ts-pattern'
import { z } from 'zod'
import { zx } from 'zodix'
import { Stack } from '~/app/components/ui'
import type { Route } from './+types/route'
import {
  CompanySettings,
  DeleteCompany,
  ExportSettings,
  IntegrationSettings,
} from './forms'
import {
  companySettingsAction,
  deleteCompanyAction,
  exportSettingsAction,
  integrationSettingsAction,
} from './forms/actions.server'
import {
  getCompany,
  getExportSetting,
  getIntegration,
} from './functions/queries.server'
import { INTENTS, intentsSchema } from './types'

export const loader = async ({ params }: Route.LoaderArgs) => {
  const { company: companyId } = zx.parseParams(params, {
    company: z.string(),
  })
  const company = await getCompany(companyId)
  if (!company) {
    throw new Response('Company not found', { status: 404 })
  }
  const exportSetting = await getExportSetting(companyId)
  const integration = await getIntegration(companyId)
  return { company, exportSetting, integration }
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
    .with(INTENTS.companySettings, () =>
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
    .with(INTENTS.deleteCompany, () =>
      deleteCompanyAction({ request, params, context }),
    )
    .exhaustive()
}

export default function CompanySettingsPage({
  loaderData: { company, exportSetting, integration },
}: Route.ComponentProps) {
  return (
    <Stack>
      <CompanySettings company={company} />
      <IntegrationSettings integration={integration} />
      <ExportSettings exportSetting={exportSetting} />
      <DeleteCompany company={company} />
    </Stack>
  )
}
