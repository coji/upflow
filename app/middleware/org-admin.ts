import { redirect } from 'react-router'
import type { Route } from '../routes/$orgSlug/settings/+types/_layout'
import { orgContext } from './context'

export const orgAdminMiddleware: Route.MiddlewareFunction = (
  { params, context },
  next,
) => {
  const { membership } = context.get(orgContext)
  if (membership.role !== 'owner' && membership.role !== 'admin') {
    throw redirect(`/${params.orgSlug}`)
  }
  return next()
}
