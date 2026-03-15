import { href, redirect } from 'react-router'
import { isOrgAdmin } from '~/app/libs/member-role'
import type { Route } from '../routes/$orgSlug/settings/+types/_layout'
import { orgContext } from './context'

export const orgAdminMiddleware: Route.MiddlewareFunction = (
  { params, context },
  next,
) => {
  const { membership } = context.get(orgContext)
  if (!isOrgAdmin(membership.role)) {
    throw redirect(href('/:orgSlug', { orgSlug: params.orgSlug }))
  }
  return next()
}
