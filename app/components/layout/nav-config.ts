import {
  GithubIcon,
  GitPullRequestIcon,
  LayoutDashboardIcon,
  SettingsIcon,
  TimerIcon,
  UsersIcon,
} from 'lucide-react'
import type { NavGroupProps } from './types'

export function getNavConfig(orgSlug: string): NavGroupProps[] {
  return [
    {
      title: 'Analytics',
      items: [
        {
          title: 'Dashboard',
          url: `/${orgSlug}`,
          icon: LayoutDashboardIcon,
        },
        {
          title: 'Ongoing',
          url: `/${orgSlug}/ongoing`,
          icon: TimerIcon,
        },
      ],
    },
    {
      title: 'Management',
      items: [
        {
          title: 'Members',
          url: `/${orgSlug}/settings/members`,
          icon: UsersIcon,
        },
        {
          title: 'Repositories',
          url: `/${orgSlug}/settings/repositories`,
          icon: GitPullRequestIcon,
        },
        {
          title: 'GitHub Users',
          url: `/${orgSlug}/settings/github-users`,
          icon: GithubIcon,
        },
        {
          title: 'Settings',
          url: `/${orgSlug}/settings`,
          icon: SettingsIcon,
        },
      ],
    },
  ]
}
