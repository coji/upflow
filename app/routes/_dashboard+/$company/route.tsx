import { unstable_defineLoader as defineLoader } from '@remix-run/node'
import {
  Link,
  Outlet,
  useLoaderData,
  useLocation,
  type MetaArgs_SingleFetch,
} from '@remix-run/react'
import { $path } from 'remix-routes'
import { z } from 'zod'
import { zx } from 'zodix'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Tabs,
  TabsList,
  TabsTrigger,
} from '~/app/components/ui'
import { getCompany } from './queries.server'

export const meta = ({ data }: MetaArgs_SingleFetch<typeof loader>) => [
  { title: `${data?.company.name} - Upflow Admin` },
]

export const handle = {
  breadcrumb: ({
    company,
  }: {
    company: NonNullable<Awaited<ReturnType<typeof getCompany>>>
  }) => {
    return {
      label: company.name,
      to: $path('/admin/:company', { company: company.id }),
    }
  },
}

export const loader = defineLoader(async ({ params }) => {
  const { company: companyId } = zx.parseParams(params, { company: z.string() })
  const company = await getCompany(companyId)
  if (!company) {
    throw new Response('Company not found', { status: 404 })
  }
  return { company }
})

export default function CompanyLayout() {
  const { company } = useLoaderData<typeof loader>()
  const location = useLocation()
  const tabValue = location.pathname.split('/')?.[2] ?? 'dashboard'

  return (
    <Card>
      <CardHeader>
        <CardTitle>{company.name}</CardTitle>

        <Tabs value={tabValue}>
          <TabsList>
            <TabsTrigger value="dashboard" asChild>
              <Link to={$path('/:company', { company: company.id })}>
                Dashboard
              </Link>
            </TabsTrigger>
            <TabsTrigger value="ongoing" asChild>
              <Link to={$path('/:company/ongoing', { company: company.id })}>
                Ongoing
              </Link>
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
