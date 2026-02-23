import { getNavConfig } from '~/app/components/layout/nav-config'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '~/app/components/ui/sidebar'
import { NavGroup } from './nav-group'
import { NavUser } from './nav-user'
import { OrgSwitcher } from './org-switcher'

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  user: {
    id: string
    name: string
    email: string
    image?: string | null
    role?: string | null
  }
  organization: {
    id: string
    name: string
    slug: string | null
  }
  organizations: Array<{
    id: string
    name: string
    slug: string | null
  }>
}

export function AppSidebar({
  user,
  organization,
  organizations,
  ...props
}: AppSidebarProps) {
  const orgSlug = organization.slug ?? organization.id
  const navGroups = getNavConfig(orgSlug)

  return (
    <Sidebar collapsible="icon" variant="floating" {...props}>
      <SidebarHeader>
        <OrgSwitcher currentOrg={organization} organizations={organizations} />
      </SidebarHeader>
      <SidebarContent>
        {navGroups.map((group) => (
          <NavGroup key={group.title} {...group} />
        ))}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
