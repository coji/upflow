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
import { getOrganization } from './queries.server'

export const meta = ({ data }: Route.MetaArgs) => [
  { title: `${data?.organization.name} - Upflow` },
]

export const handle = {
  breadcrumb: ({ organization }: Awaited<ReturnType<typeof loader>>) => {
    return {
      label: organization.name,
      to: href('/:organization', { organization: organization.id }),
    }
  },
}

export const loader = async ({ params }: Route.LoaderArgs) => {
  const { organization: organizationId } = zx.parseParams(params, {
    organization: z.string(),
  })
  const organization = await getOrganization(organizationId)
  if (!organization) {
    throw new Response('Organization not found', { status: 404 })
  }

  return { organization }
}

export default function OrganizationLayout({
  loaderData: { organization },
}: Route.ComponentProps) {
  const location = useLocation()
  const tabValue = location.pathname.split('/')?.[2] ?? 'dashboard'

  return (
    <Card>
      <CardHeader>
        <CardTitle>{organization.name}</CardTitle>

        <Tabs value={tabValue}>
          <TabsList>
            <TabsTrigger value="dashboard" asChild>
              <Link
                to={href('/:organization', { organization: organization.id })}
              >
                Dashboard
              </Link>
            </TabsTrigger>
            <TabsTrigger value="ongoing" asChild>
              <Link
                to={href('/:organization/ongoing', {
                  organization: organization.id,
                })}
              >
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
