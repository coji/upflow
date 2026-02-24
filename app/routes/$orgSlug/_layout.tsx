import { Outlet, useMatches } from 'react-router'
import { AppSidebar } from '~/app/components/layout/app-sidebar'
import { Header } from '~/app/components/layout/header'
import { Main } from '~/app/components/layout/main'
import { SidebarProvider } from '~/app/components/ui/sidebar'
import { useBreadcrumbs } from '~/app/hooks/use-breadcrumbs'
import { getUserOrganizations, requireOrgMember } from '~/app/libs/auth.server'
import { cn } from '~/app/libs/utils'
import type { Route } from './+types/_layout'

export interface RouteHandle {
  breadcrumb?: (data?: unknown) => { label: string; to?: string }
  headerFixed?: boolean
  mainFixed?: boolean
}

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
  loaderData: { user, organization, membership, organizations },
}: Route.ComponentProps) {
  const { Breadcrumbs } = useBreadcrumbs()
  const matches = useMatches()
  const handle = matches.reduce<Record<string, unknown>>((acc, m) => {
    if (m.handle && typeof m.handle === 'object') Object.assign(acc, m.handle)
    return acc
  }, {}) as RouteHandle

  return (
    <SidebarProvider>
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
        <Header fixed={handle.headerFixed} />
        <Breadcrumbs />
        <Main fixed={handle.mainFixed}>
          <Outlet />
        </Main>
      </div>
    </SidebarProvider>
  )
}
