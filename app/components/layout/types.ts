interface BaseNavItem {
  title: string
  badge?: string
  icon?: React.ElementType
}

type NavLink = BaseNavItem & {
  url: string
  items?: never
}

type NavCollapsible = BaseNavItem & {
  items: (BaseNavItem & { url: string })[]
  url?: never
}

type NavItem = NavCollapsible | NavLink

interface NavGroupProps {
  title: string
  items: NavItem[]
  adminOnly?: boolean
}

export type { NavCollapsible, NavGroupProps, NavItem, NavLink }
