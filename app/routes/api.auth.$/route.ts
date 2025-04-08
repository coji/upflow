import { auth } from '~/app/libs/auth.server'
import type { Route } from './+types/route'

export const loader = ({ request }: Route.LoaderArgs) => {
  return auth.handler(request)
}

export const action = ({ request }: Route.ActionArgs) => {
  return auth.handler(request)
}
