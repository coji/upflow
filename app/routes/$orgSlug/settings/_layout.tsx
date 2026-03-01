import {
  AlertTriangleIcon,
  DatabaseIcon,
  FileSpreadsheetIcon,
  GitPullRequestIcon,
  GithubIcon,
  GroupIcon,
  PlugIcon,
  SettingsIcon,
  UsersIcon,
} from 'lucide-react'
import { Outlet } from 'react-router'
import {
  PageHeader,
  PageHeaderDescription,
  PageHeaderHeading,
  PageHeaderTitle,
} from '~/app/components/layout/page-header'
import { Separator } from '~/app/components/ui/separator'
import { requireOrgAdmin } from '~/app/libs/auth.server'
import type { RouteHandle } from '~/app/routes/$orgSlug/_layout'
import SidebarNav from './+components/sidebar-nav'
import type { Route } from './+types/_layout'

export const handle: RouteHandle = {
  breadcrumb: (_data: unknown, params?: Record<string, string>) => ({
    label: 'Settings',
    to: `/${params?.orgSlug}/settings`,
  }),
}

export const loader = async ({ request, params }: Route.LoaderArgs) => {
  await requireOrgAdmin(request, params.orgSlug)
  return { orgSlug: params.orgSlug }
}

export default function SettingsLayout({
  loaderData: { orgSlug },
}: Route.ComponentProps) {
  const sidebarNavItems = [
    {
      title: 'General',
      icon: <SettingsIcon size={18} />,
      href: `/${orgSlug}/settings`,
    },
    {
      title: 'Integration',
      icon: <PlugIcon size={18} />,
      href: `/${orgSlug}/settings/integration`,
    },
    {
      title: 'Members',
      icon: <UsersIcon size={18} />,
      href: `/${orgSlug}/settings/members`,
    },
    {
      title: 'Repositories',
      icon: <GitPullRequestIcon size={18} />,
      href: `/${orgSlug}/settings/repositories`,
    },
    {
      title: 'Teams',
      icon: <GroupIcon size={18} />,
      href: `/${orgSlug}/settings/teams`,
    },
    {
      title: 'GitHub Users',
      icon: <GithubIcon size={18} />,
      href: `/${orgSlug}/settings/github-users`,
    },
    {
      title: 'Export',
      icon: <FileSpreadsheetIcon size={18} />,
      href: `/${orgSlug}/settings/export`,
    },
    {
      title: 'Data Management',
      icon: <DatabaseIcon size={18} />,
      href: `/${orgSlug}/settings/data-management`,
    },
    {
      title: 'Danger Zone',
      icon: <AlertTriangleIcon size={18} />,
      href: `/${orgSlug}/settings/danger`,
    },
  ]

  return (
    <>
      <PageHeader>
        <PageHeaderHeading>
          <PageHeaderTitle>Settings</PageHeaderTitle>
          <PageHeaderDescription>
            Manage your organization settings and preferences.
          </PageHeaderDescription>
        </PageHeaderHeading>
      </PageHeader>
      <Separator className="my-0 lg:my-2" />
      <div className="flex flex-1 flex-col space-y-2 overflow-hidden md:space-y-2 lg:flex-row lg:space-y-0 lg:space-x-12">
        <aside className="top-0 lg:sticky lg:w-52">
          <SidebarNav items={sidebarNavItems} />
        </aside>
        <div className="flex min-w-0 flex-1 overflow-y-hidden p-1 pr-4">
          <Outlet />
        </div>
      </div>
    </>
  )
}
