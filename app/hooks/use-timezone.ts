import { useRouteLoaderData } from 'react-router'
import { DEFAULT_TIMEZONE } from '~/app/libs/constants'
import type { loader } from '~/app/routes/$orgSlug/_layout'

export function useTimezone(): string {
  const data = useRouteLoaderData<typeof loader>('routes/$orgSlug/_layout')
  return data?.timezone ?? DEFAULT_TIMEZONE
}
