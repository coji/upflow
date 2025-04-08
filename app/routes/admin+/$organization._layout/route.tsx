import { href, Outlet } from 'react-router'
import { z } from 'zod'
import { zx } from 'zodix'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  Stack,
} from '~/app/components/ui'
import { useBreadcrumbs } from '~/app/hooks/AppBreadcrumbs'
import type { Route } from './+types/route'
import { OrganizationNavLink } from './components'
import { getOrganization } from './functions.server'

export const meta = ({ data }: Route.MetaArgs) => [
  { title: `${data?.organization.name} - Upflow Admin` },
]

export const handle = {
  breadcrumb: ({ organization }: Awaited<ReturnType<typeof loader>>) => {
    return {
      label: organization.name,
      to: href('/admin/:organization', { organization: organization.id }),
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
  return { organizationId, organization }
}

export default function OrganizationLayout({
  loaderData: { organization },
}: Route.ComponentProps) {
  const { AppBreadcrumbs } = useBreadcrumbs()

  return (
    <div className="grid min-h-full grid-cols-[auto_1fr] gap-2">
      <div>
        <Card className="w-60">
          <CardHeader>
            <CardTitle>{organization.name}</CardTitle>
          </CardHeader>

          <CardContent>
            <Stack className="bg-popover text-popover-foreground flex-1 gap-0 overflow-hidden transition-colors">
              <OrganizationNavLink
                to={href('/admin/:organization/members', {
                  organization: organization.id,
                })}
              >
                Users
              </OrganizationNavLink>

              <OrganizationNavLink
                to={href('/admin/:organization/repositories', {
                  organization: organization.id,
                })}
              >
                Repositories
              </OrganizationNavLink>
            </Stack>
          </CardContent>

          <CardFooter>
            <OrganizationNavLink
              to={href('/admin/:organization/settings', {
                organization: organization.id,
              })}
            >
              Settings
            </OrganizationNavLink>
          </CardFooter>
        </Card>
      </div>

      <div>
        <>
          <AppBreadcrumbs />
          <Outlet />
        </>
      </div>
    </div>
  )
}
