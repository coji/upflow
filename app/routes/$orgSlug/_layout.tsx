import { Outlet, useMatches } from 'react-router'
import { AppSidebar } from '~/app/components/layout/app-sidebar'
import { Header } from '~/app/components/layout/header'
import { Main } from '~/app/components/layout/main'
import { SidebarProvider } from '~/app/components/ui/sidebar'
import { useBreadcrumbs } from '~/app/hooks/use-breadcrumbs'
import { getUserOrganizations } from '~/app/libs/auth.server'
import { cn } from '~/app/libs/utils'
import { orgContext, timezoneContext } from '~/app/middleware/context'
import { orgMemberMiddleware } from '~/app/middleware/org-member'
import type { Route } from './+types/_layout'

export interface RouteHandle {
  breadcrumb?: (
    data?: unknown,
    params?: Record<string, string>,
  ) => { label: string; to?: string }
  headerFixed?: boolean
  mainFixed?: boolean
}

export const meta = ({ data }: Route.MetaArgs) => [
  { title: `${data?.organization.name} - Upflow` },
]

export const handle = {
  breadcrumb: (
    data: Awaited<ReturnType<typeof loader>>,
    params: { orgSlug: string },
  ) => ({
    label: data.organization.name,
    to: `/${params.orgSlug}`,
  }),
}

export const middleware = [orgMemberMiddleware]

export const loader = async ({ request, context }: Route.LoaderArgs) => {
  const { user, organization, membership } = context.get(orgContext)
  const timezone = context.get(timezoneContext)
  const organizations = await getUserOrganizations(user.id)

  const cookieHeader = request.headers.get('Cookie') ?? ''
  const sidebarState = cookieHeader
    .split('; ')
    .find((c) => c.startsWith('sidebar_state='))
    ?.split('=')[1]
  const defaultOpen = sidebarState !== 'false'

  return {
    user,
    organization,
    membership,
    organizations,
    defaultOpen,
    timezone,
  }
}

export default function OrgLayout({
  loaderData: { user, organization, membership, organizations, defaultOpen },
}: Route.ComponentProps) {
  const { Breadcrumbs } = useBreadcrumbs()
  const matches = useMatches()
  const handle = matches.reduce<Record<string, unknown>>((acc, m) => {
    if (m.handle && typeof m.handle === 'object') Object.assign(acc, m.handle)
    return acc
  }, {}) as RouteHandle

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar
        user={user}
        organization={organization}
        organizations={organizations}
        memberRole={membership.role}
      />
      <div
        id="content"
        className={cn(
          'ml-auto w-full max-w-full',
          'peer-data-[state=collapsed]:w-[calc(100%-var(--sidebar-width-icon)-1rem)]',
          'peer-data-[state=expanded]:w-[calc(100%-var(--sidebar-width))]',
          'transition-[width] duration-200 ease-linear',
          'flex h-svh flex-col',
        )}
      >
        <Header fixed={handle.headerFixed}>
          <Breadcrumbs />
        </Header>
        <Main fixed={handle.mainFixed}>
          <Outlet />
        </Main>
      </div>
    </SidebarProvider>
  )
}
