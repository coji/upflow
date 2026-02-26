import React from 'react'
import { Link, useMatches } from 'react-router'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '~/app/components/ui/breadcrumb'

interface MatchedBreadcrumbItem {
  label: string
  to?: string
  isCurrentPage?: boolean
}

function isBreadcrumbHandle(handle: unknown): handle is {
  breadcrumb: (data: unknown, params: Record<string, string>) => object
} {
  return (
    typeof handle === 'object' &&
    !!handle &&
    'breadcrumb' in handle &&
    typeof handle.breadcrumb === 'function'
  )
}

export const useBreadcrumbs = () => {
  const matches = useMatches()
  const breadcrumbMatches = matches.filter((match) =>
    isBreadcrumbHandle(match.handle),
  )

  const breadcrumbItems = breadcrumbMatches.map((match, idx) => {
    if (!isBreadcrumbHandle(match.handle)) {
      return null
    }
    return {
      ...match.handle.breadcrumb(
        match.data,
        match.params as Record<string, string>,
      ),
      isCurrentPage: idx === breadcrumbMatches.length - 1,
    }
  }) as MatchedBreadcrumbItem[]

  const Breadcrumbs = () => {
    return (
      <Breadcrumb>
        <BreadcrumbList>
          {breadcrumbItems.map((item, idx) => {
            return (
              <React.Fragment key={item.label}>
                {idx > 0 && <BreadcrumbSeparator />}
                <BreadcrumbItem>
                  {item.to && !item.isCurrentPage ? (
                    <BreadcrumbLink asChild>
                      <Link to={item.to}>{item.label}</Link>
                    </BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage>{item.label}</BreadcrumbPage>
                  )}
                </BreadcrumbItem>
              </React.Fragment>
            )
          })}
        </BreadcrumbList>
      </Breadcrumb>
    )
  }

  return { Breadcrumbs }
}
