import { href, Link, Outlet, useLocation } from 'react-router'
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
import type { Route } from './+types/route'
import { getCompany } from './queries.server'

export const meta = ({ data }: Route.MetaArgs) => [
  { title: `${data?.company.name} - Upflow Admin` },
]

export const handle = {
  breadcrumb: ({ company }: Awaited<ReturnType<typeof loader>>) => {
    return {
      label: company.name,
      to: href('/admin/:company', { company: company.id }),
    }
  },
}

export const loader = async ({ params }: Route.LoaderArgs) => {
  const { company: companyId } = zx.parseParams(params, {
    company: z.string(),
  })
  const company = await getCompany(companyId)
  if (!company) {
    throw new Response('Company not found', { status: 404 })
  }

  return { company }
}

export default function CompanyLayout({
  loaderData: { company },
}: Route.ComponentProps) {
  const location = useLocation()
  const tabValue = location.pathname.split('/')?.[2] ?? 'dashboard'

  return (
    <Card>
      <CardHeader>
        <CardTitle>{company.name}</CardTitle>

        <Tabs value={tabValue}>
          <TabsList>
            <TabsTrigger value="dashboard" asChild>
              <Link to={href('/:company', { company: company.id })}>
                Dashboard
              </Link>
            </TabsTrigger>
            <TabsTrigger value="ongoing" asChild>
              <Link to={href('/:company/ongoing', { company: company.id })}>
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
