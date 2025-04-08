import { useLocation } from 'react-router'
import { match } from 'ts-pattern'

export const useCurrentOrganization = () => {
  const location = useLocation()
  return match(location.pathname)
    .when(
      (val) => val.startsWith('/admin') && val.split('/').length > 2,
      (val) => val.split('/')[2],
    )
    .when(
      (val) => val.split('/').length > 1,
      (val) => val.split('/')[1],
    )
    .otherwise(() => null)
}
