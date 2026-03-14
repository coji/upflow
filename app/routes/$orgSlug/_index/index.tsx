import { redirect } from 'react-router'
import type { Route } from './+types/index'

export const loader = ({ request, params }: Route.LoaderArgs) => {
  const { search } = new URL(request.url)
  return redirect(`/${params.orgSlug}/stacks${search}`)
}
