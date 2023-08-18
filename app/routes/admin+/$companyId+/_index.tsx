import { json, type LoaderArgs } from '@remix-run/node'
import { Link, useLoaderData } from '@remix-run/react'
import { z } from 'zod'
import { zx } from 'zodix'
import { AppProviderBadge } from '~/app/components'
import { Button, HStack, Stack } from '~/app/components/ui'
import { getCompany } from '~/app/models/admin/company.server'

export const loader = async ({ params }: LoaderArgs) => {
  const { companyId } = zx.parseParams(params, { companyId: z.string() })
  const company = await getCompany(companyId)
  if (!company) {
    throw new Response('Company not found', { status: 404 })
  }
  return json({ company })
}

const CompanyPage = () => {
  const { company } = useLoaderData<typeof loader>()

  return (
    <Stack>
      <HStack>
        {company.integration ? (
          <div>
            <AppProviderBadge provider={company.integration.provider} />
          </div>
        ) : (
          <Button asChild>
            <Link to="add-integration">Add Integration</Link>
          </Button>
        )}

        {!company.exportSetting && (
          <Button asChild>
            <Link to="export-setting">{company.exportSetting ? 'Export Settings' : 'Add Export Setting'}</Link>
          </Button>
        )}
      </HStack>
    </Stack>
  )
}
export default CompanyPage
