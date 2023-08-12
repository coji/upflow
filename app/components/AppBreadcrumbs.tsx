import { Link, useMatches } from '@remix-run/react'
import React from 'react'

export const useBreadcrumbs = () => {
  const matches = useMatches()
  const breadcrumbMatches = matches.filter((match) => match.handle?.breadcrumb)
  const breadcrumbs = breadcrumbMatches.map((match, idx) => {
    return {
      ...match.handle?.breadcrumb(match.data),
      isCurrentPage: idx === breadcrumbMatches.length - 1,
    }
  }) as { label: string; to: string }[]
  return breadcrumbs
}

interface AppBreadcrumbItem {
  label: string
  to?: string
  isCurrentPage?: boolean
}
interface AppBreadcrumbsProps {
  items: AppBreadcrumbItem[]
}
export const AppBreadcrumbs = ({ items }: AppBreadcrumbsProps) => {
  return (
    <nav className="inline-flex py-1 text-sm">
      <ul className="inline-flex gap-2">
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1
          return (
            <React.Fragment key={idx}>
              <li>
                {item.to && !item.isCurrentPage ? <Link to={item.to}>{item.label}</Link> : <span>{item.label}</span>}
              </li>
              {!isLast && <li>/</li>}
            </React.Fragment>
          )
        })}
      </ul>
    </nav>
  )
}
