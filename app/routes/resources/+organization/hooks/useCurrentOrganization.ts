import { useLocation } from 'react-router'

const RESERVED_PREFIXES = new Set([
  'admin',
  'login',
  'logout',
  'api',
  'resources',
  'healthcheck',
  'no-org',
  'sign-in',
  'sign-up',
])

/**
 * Extracts the current org slug from the URL pathname.
 * URL pattern: /:orgSlug/...
 * Returns null for reserved paths like /admin, /login, etc.
 */
export const useCurrentOrganization = () => {
  const location = useLocation()
  const segments = location.pathname.split('/').filter(Boolean)
  const firstSegment = segments[0]
  if (!firstSegment || RESERVED_PREFIXES.has(firstSegment)) {
    return null
  }
  return firstSegment
}
