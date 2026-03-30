import {
  ChartAreaIcon,
  CircleDotIcon,
  FunnelIcon,
  GitMergeIcon,
  LayersIcon,
  NotebookPenIcon,
  RocketIcon,
  SettingsIcon,
} from 'lucide-react'
import { href } from 'react-router'
import type { NavGroupProps } from './types'

export function getNavConfig(orgSlug: string): NavGroupProps[] {
  return [
    {
      title: 'Workload',
      items: [
        {
          title: 'Review Stacks',
          url: href('/:orgSlug/workload', { orgSlug }),
          icon: LayersIcon,
        },
      ],
    },
    {
      title: 'Throughput',
      items: [
        {
          title: 'Ongoing',
          url: href('/:orgSlug/throughput/ongoing', { orgSlug }),
          icon: CircleDotIcon,
        },
        {
          title: 'Merged',
          url: href('/:orgSlug/throughput/merged', { orgSlug }),
          icon: GitMergeIcon,
        },
        {
          title: 'Deployed',
          url: href('/:orgSlug/throughput/deployed', { orgSlug }),
          icon: RocketIcon,
        },
      ],
    },
    {
      title: 'Analysis',
      items: [
        {
          title: 'Review Bottleneck',
          url: href('/:orgSlug/analysis/reviews', { orgSlug }),
          icon: FunnelIcon,
        },
        {
          title: 'Inventory',
          url: href('/:orgSlug/analysis/inventory', { orgSlug }),
          icon: ChartAreaIcon,
        },
        {
          title: 'Feedbacks',
          url: href('/:orgSlug/analysis/feedbacks', { orgSlug }),
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
          url: href('/:orgSlug/settings', { orgSlug }),
          icon: SettingsIcon,
        },
      ],
    },
  ]
}
