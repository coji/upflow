import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node'
import { typedjson, useTypedLoaderData } from 'remix-typedjson'
import { match } from 'ts-pattern'
import { z } from 'zod'
import { zx } from 'zodix'
import { Stack } from '~/app/components/ui'
import { CompanySettings } from './forms/company-settings'
import { action as companySettingsAction } from './forms/company-settings.action.server'
import { ExportSettings } from './forms/export-settings'
import { action as exportSettingsAction } from './forms/export-settings.action.server'
import { IntegrationSettings } from './forms/integration-settings'
import { action as integrationSettingsAction } from './forms/integration-settings.action.server'
import {
  getCompany,
  getExportSetting,
  getIntegration,
} from './functions/queries.server'
import { INTENTS, intentsSchema } from './types'

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const { companyId } = zx.parseParams(params, { companyId: z.string() })
  const company = await getCompany(companyId)
  if (!company) {
    throw new Response('Company not found', { status: 404 })
  }
  const exportSetting = await getExportSetting(companyId)
  const integration = await getIntegration(companyId)
  return typedjson({ company, exportSetting, integration })
}

export const action = async ({
  request,
  params,
  context,
}: ActionFunctionArgs) => {
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

    .exhaustive()
}

export default function CompanySettingsPage() {
  const { company, exportSetting, integration } =
    useTypedLoaderData<typeof loader>()
  return (
    <Stack>
      <CompanySettings company={company} />
      <IntegrationSettings integration={integration} />
      <ExportSettings exportSetting={exportSetting} />
    </Stack>
  )
}
