import { authenticator } from '~/app/features/auth/services/authenticator.server'
import type { Route } from './+types/auth.google'

export const loader = async ({ request }: Route.LoaderArgs) => {
  return await authenticator.authenticate('google', request)
}
