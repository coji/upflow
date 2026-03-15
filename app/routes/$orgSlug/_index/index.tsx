import { href, redirect } from 'react-router'
import type { Route } from './+types/index'

export const loader = ({ request, params }: Route.LoaderArgs) => {
  const { search } = new URL(request.url)
  return redirect(
    `${href('/:orgSlug/workload', { orgSlug: params.orgSlug })}${search}`,
  )
}
