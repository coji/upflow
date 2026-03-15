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
import { Outlet, href } from 'react-router'
import {
  PageHeader,
  PageHeaderDescription,
  PageHeaderHeading,
  PageHeaderTitle,
} from '~/app/components/layout/page-header'
import { Separator } from '~/app/components/ui/separator'
import { orgAdminMiddleware } from '~/app/middleware/org-admin'
import type { RouteHandle } from '~/app/routes/$orgSlug/_layout'
import SidebarNav from './+components/sidebar-nav'
import type { Route } from './+types/_layout'

export const handle: RouteHandle = {
  breadcrumb: (_data: unknown, params?: Record<string, string>) => ({
    label: 'Settings',
    to: href('/:orgSlug/settings', { orgSlug: params?.orgSlug ?? '' }),
  }),
}

export const middleware = [orgAdminMiddleware]

export const loader = ({ params }: Route.LoaderArgs) => {
  return { orgSlug: params.orgSlug }
}

export default function SettingsLayout({
  loaderData: { orgSlug },
}: Route.ComponentProps) {
  const sidebarNavItems = [
    {
      title: 'General',
      icon: <SettingsIcon size={18} />,
      href: href('/:orgSlug/settings', { orgSlug }),
    },
    {
      title: 'Integration',
      icon: <PlugIcon size={18} />,
      href: href('/:orgSlug/settings/integration', { orgSlug }),
    },
    {
      title: 'Members',
      icon: <UsersIcon size={18} />,
      href: href('/:orgSlug/settings/members', { orgSlug }),
    },
    {
      title: 'Repositories',
      icon: <GitPullRequestIcon size={18} />,
      href: href('/:orgSlug/settings/repositories', { orgSlug }),
    },
    {
      title: 'Teams',
      icon: <GroupIcon size={18} />,
      href: href('/:orgSlug/settings/teams', { orgSlug }),
    },
    {
      title: 'GitHub Users',
      icon: <GithubIcon size={18} />,
      href: href('/:orgSlug/settings/github-users', { orgSlug }),
    },
    {
      title: 'Export',
      icon: <FileSpreadsheetIcon size={18} />,
      href: href('/:orgSlug/settings/export', { orgSlug }),
    },
    {
      title: 'Data Management',
      icon: <DatabaseIcon size={18} />,
      href: href('/:orgSlug/settings/data-management', { orgSlug }),
    },
    {
      title: 'Danger Zone',
      icon: <AlertTriangleIcon size={18} />,
      href: href('/:orgSlug/settings/danger', { orgSlug }),
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
