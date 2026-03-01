import {
  GitPullRequestIcon,
  LayoutDashboardIcon,
  SettingsIcon,
  TimerIcon,
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
        {
          title: 'Reviews',
          url: `/${orgSlug}/reviews`,
          icon: GitPullRequestIcon,
        },
      ],
    },
    {
      title: 'Management',
      adminOnly: true,
      items: [
        {
          title: 'Settings',
          url: `/${orgSlug}/settings`,
          icon: SettingsIcon,
        },
      ],
    },
  ]
}
