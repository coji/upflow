import { json, type LoaderArgs, type V2_MetaFunction } from '@remix-run/node'
import { Link, Outlet, useLoaderData, useLocation } from '@remix-run/react'
import { z } from 'zod'
import { zx } from 'zodix'
import { Card, CardContent, CardHeader, CardTitle, Tabs, TabsList, TabsTrigger } from '~/app/components/ui'
import { getCompany } from '~/app/models/admin/company.server'
import { getPullRequestReport } from '~/app/models/pullRequest.server'

export const meta: V2_MetaFunction<typeof loader> = ({ data }) => [{ title: `${data?.company.name} - Upflow Admin` }]

export const handle = {
  breadcrumb: ({ company }: { company: NonNullable<Awaited<ReturnType<typeof getCompany>>> }) => {
    return { label: company.name, to: `/${company.id}` }
  },
}

export const loader = async ({ params }: LoaderArgs) => {
  const { companyId } = zx.parseParams(params, { companyId: z.string() })
  const company = await getCompany(companyId)
  if (!company) {
    throw new Response('Company not found', { status: 404 })
  }
  const pullRequests = getPullRequestReport(companyId)
  return json({ company, pullRequests })
}

export default function CompanyLayout() {
  const { company } = useLoaderData<typeof loader>()
  const location = useLocation()
  const tabValue = location.pathname.split('/')?.[3] ?? 'dashboard'

  return (
    <Card>
      <CardHeader>
        <CardTitle>{company.name}</CardTitle>

        <Tabs value={tabValue}>
          <TabsList>
            <TabsTrigger value="dashboard" asChild>
              <Link to=".">Dashboard</Link>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>

      <CardContent>
        <Outlet />
      </CardContent>
    </Card>
  )
}
