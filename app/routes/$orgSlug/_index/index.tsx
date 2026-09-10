import { href, redirect } from 'react-router'
import type { Route } from './+types/index'

export const loader = ({ params, url }: Route.LoaderArgs) => {
  const { search } = url
  return redirect(
    `${href('/:orgSlug/workload', { orgSlug: params.orgSlug })}${search}`,
  )
}
