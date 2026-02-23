import { Outlet } from 'react-router'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  Stack,
} from '~/app/components/ui'
import { useBreadcrumbs } from '~/app/hooks/AppBreadcrumbs'
import { requireOrgAdmin } from '~/app/libs/auth.server'
import type { Route } from './+types/_layout'
import { OrganizationNavLink } from './components'

export const meta = ({ data }: Route.MetaArgs) => [
  { title: `${data?.organization.name} Settings - Upflow` },
]

export const handle = {
  breadcrumb: ({ organization }: Awaited<ReturnType<typeof loader>>) => ({
    label: 'Settings',
    to: `/${organization.slug}/settings`,
  }),
}

export const loader = async ({ request, params }: Route.LoaderArgs) => {
  const { organization } = await requireOrgAdmin(request, params.orgSlug)
  return { organization }
}

export default function SettingsLayout({
  loaderData: { organization },
}: Route.ComponentProps) {
  const { AppBreadcrumbs } = useBreadcrumbs()
  const slug = organization.slug

  return (
    <div className="grid min-h-full grid-cols-[auto_1fr] gap-2">
      <div>
        <Card className="w-60">
          <CardHeader>
            <CardTitle>{organization.name}</CardTitle>
          </CardHeader>

          <CardContent>
            <Stack className="bg-popover text-popover-foreground flex-1 gap-0 overflow-hidden transition-colors">
              <OrganizationNavLink to={`/${slug}/settings/members`}>
                Users
              </OrganizationNavLink>

              <OrganizationNavLink to={`/${slug}/settings/repositories`}>
                Repositories
              </OrganizationNavLink>
            </Stack>
          </CardContent>

          <CardFooter>
            <OrganizationNavLink to={`/${slug}/settings`}>
              Settings
            </OrganizationNavLink>
          </CardFooter>
        </Card>
      </div>

      <div>
        <AppBreadcrumbs />
        <Outlet />
      </div>
    </div>
  )
}
