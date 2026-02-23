import { auth } from '~/app/libs/auth.server'
import type { Route } from './+types/api.auth.$'

export const loader = async ({ request }: Route.LoaderArgs) => {
  return await auth.handler(request)
}

export const action = async ({ request }: Route.ActionArgs) => {
  return await auth.handler(request)
}
