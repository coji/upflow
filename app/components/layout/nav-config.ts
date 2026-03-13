import {
  ClockIcon,
  GitPullRequestIcon,
  LayoutDashboardIcon,
  NotebookPenIcon,
  RocketIcon,
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
          title: 'Review Stacks',
          url: `/${orgSlug}/stacks`,
          icon: LayoutDashboardIcon,
        },
        {
          title: 'Ongoing',
          url: `/${orgSlug}/ongoing`,
          icon: TimerIcon,
        },
        {
          title: 'Merged',
          url: `/${orgSlug}/merged`,
          icon: ClockIcon,
        },
        {
          title: 'Reviews',
          url: `/${orgSlug}/reviews`,
          icon: GitPullRequestIcon,
        },
        {
          title: 'Deployed',
          url: `/${orgSlug}/deployed`,
          icon: RocketIcon,
        },
        {
          title: 'Feedbacks',
          url: `/${orgSlug}/feedbacks`,
          icon: NotebookPenIcon,
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
