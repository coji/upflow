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
      title: 'Workload',
      items: [
        {
          title: 'Review Stacks',
          url: `/${orgSlug}/workload`,
          icon: LayoutDashboardIcon,
        },
      ],
    },
    {
      title: 'Throughput',
      items: [
        {
          title: 'Ongoing',
          url: `/${orgSlug}/throughput/ongoing`,
          icon: TimerIcon,
        },
        {
          title: 'Merged',
          url: `/${orgSlug}/throughput/merged`,
          icon: ClockIcon,
        },
        {
          title: 'Deployed',
          url: `/${orgSlug}/throughput/deployed`,
          icon: RocketIcon,
        },
      ],
    },
    {
      title: 'Analysis',
      items: [
        {
          title: 'Review Bottleneck',
          url: `/${orgSlug}/analysis/reviews`,
          icon: GitPullRequestIcon,
        },
        {
          title: 'Feedbacks',
          url: `/${orgSlug}/analysis/feedbacks`,
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
