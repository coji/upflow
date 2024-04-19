import type { LoaderFunctionArgs } from '@remix-run/node'
import { typedjson, useTypedLoaderData } from 'remix-typedjson'
import { z } from 'zod'
import { zx } from 'zodix'
import { Stack } from '~/app/components/ui'
import { CompanySettings } from '../settings.company/route'
import { ExportSettings } from '../settings.export/route'
import { getCompany, getExportSetting } from './queries.server'

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const { companyId } = zx.parseParams(params, { companyId: z.string() })
  const company = await getCompany(companyId)
  if (!company) {
    throw new Response('Company not found', { status: 404 })
  }
  const exportSetting = await getExportSetting(companyId)
  return typedjson({ company, exportSetting })
}

export default function CompanySettingsPage() {
  const { company, exportSetting } = useTypedLoaderData<typeof loader>()
  return (
    <Stack>
      <CompanySettings company={company} />
      <ExportSettings companyId={company.id} exportSetting={exportSetting} />
    </Stack>
  )
}
