import { Link, Outlet, useLocation } from 'react-router'
import { AppHeader, AppLayout } from '~/app/components'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Tabs,
  TabsList,
  TabsTrigger,
} from '~/app/components/ui'
import { useBreadcrumbs } from '~/app/hooks/AppBreadcrumbs'
import { getUserOrganizations, requireOrgMember } from '~/app/libs/auth.server'
import type { Route } from './+types/_layout'

export const meta = ({ data }: Route.MetaArgs) => [
  { title: `${data?.organization.name} - Upflow` },
]

export const handle = {
  breadcrumb: ({ organization }: Awaited<ReturnType<typeof loader>>) => ({
    label: organization.name,
    to: `/${organization.slug}`,
  }),
}

export const loader = async ({ request, params }: Route.LoaderArgs) => {
  const { orgSlug } = params
  const { user, organization, membership } = await requireOrgMember(
    request,
    orgSlug,
  )
  const organizations = await getUserOrganizations(user.id)
  return { user, organization, membership, organizations }
}

export default function OrgLayout({
  loaderData: { organization },
}: Route.ComponentProps) {
  const { AppBreadcrumbs } = useBreadcrumbs()
  const location = useLocation()
  const pathParts = location.pathname.split('/').filter(Boolean)
  const tabValue = pathParts[1] === 'ongoing' ? 'ongoing' : 'dashboard'

  return (
    <AppLayout header={<AppHeader />} breadcrumbs={<AppBreadcrumbs />}>
      <Card>
        <CardHeader>
          <CardTitle>{organization.name}</CardTitle>

          <Tabs value={tabValue}>
            <TabsList>
              <TabsTrigger value="dashboard" asChild>
                <Link to={`/${organization.slug}`}>Dashboard</Link>
              </TabsTrigger>
              <TabsTrigger value="ongoing" asChild>
                <Link to={`/${organization.slug}/ongoing`}>Ongoing</Link>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>

        <CardContent>
          <Outlet />
        </CardContent>
      </Card>
    </AppLayout>
  )
}
