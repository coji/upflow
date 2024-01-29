import { Link, useMatches } from '@remix-run/react'
import React from 'react'

interface AppBreadcrumbItem {
  label: string
  to?: string
  isCurrentPage?: boolean
}

function isBreadcrumbHandle(handle: unknown): handle is { breadcrumb: (params: unknown) => object } {
  return typeof handle === 'object' && !!handle && 'breadcrumb' in handle && typeof handle.breadcrumb === 'function'
}

export const useBreadcrumbs = () => {
  const matches = useMatches()
  const breadcrumbMatches = matches.filter((match) => isBreadcrumbHandle(match.handle))
  const breadcrumbs = breadcrumbMatches.map((match, idx) => {
    if (!isBreadcrumbHandle(match.handle)) {
      return null
    }
    return {
      ...match.handle.breadcrumb(match.data),
      isCurrentPage: idx === breadcrumbMatches.length - 1,
    }
  }) as AppBreadcrumbItem[]

  const AppBreadcrumbs = () => {
    return (
      <nav className="inline-flex py-1 text-sm">
        <ul className="inline-flex gap-2">
          {breadcrumbs.map((item, idx) => {
            const i = idx
            const isLast = idx === breadcrumbs.length - 1
            return (
              <React.Fragment key={i}>
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

  return { breadcrumbs, AppBreadcrumbs }
}
