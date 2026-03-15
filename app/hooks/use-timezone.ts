import { useRouteLoaderData } from 'react-router'
import type { loader } from '~/app/routes/$orgSlug/_layout'

export function useTimezone(): string {
  const data = useRouteLoaderData<typeof loader>('routes/$orgSlug/_layout')
  return data?.timezone ?? 'Asia/Tokyo'
}
