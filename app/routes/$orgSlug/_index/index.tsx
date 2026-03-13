import { redirect } from 'react-router'
import type { Route } from './+types/index'

export const loader = ({ params }: Route.LoaderArgs) => {
  return redirect(`/${params.orgSlug}/stacks`)
}
