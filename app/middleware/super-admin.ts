import { requireSuperAdmin } from '~/app/libs/auth.server'
import type { Route } from '../routes/admin/+types/_layout'

// Runs for every loader/action under /admin, including single-fetch data
// requests that target a child route directly (a parent loader alone does not).
export const superAdminMiddleware: Route.MiddlewareFunction = async (
  { request },
  next,
) => {
  await requireSuperAdmin(request)
  return next()
}
