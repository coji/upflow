import { useLocation } from 'react-router'
import { RESERVED_SLUGS } from '~/app/libs/reserved-slugs'

/**
 * Extracts the current org slug from the URL pathname.
 * URL pattern: /:orgSlug/...
 * Returns null for reserved paths like /admin, /login, etc.
 */
export const useCurrentOrganization = () => {
  const location = useLocation()
  const segments = location.pathname.split('/').filter(Boolean)
  const firstSegment = segments[0]
  if (!firstSegment || RESERVED_SLUGS.has(firstSegment.toLowerCase())) {
    return null
  }
  return firstSegment
}
