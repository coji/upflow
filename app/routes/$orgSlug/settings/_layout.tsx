import {
  AlertTriangleIcon,
  DatabaseIcon,
  FileSpreadsheetIcon,
  GitPullRequestIcon,
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
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width={18}
          height={18}
          viewBox="0 0 24 24"
          fill="currentColor"
          role="img"
          aria-label="GitHub"
        >
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
        </svg>
      ),
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
