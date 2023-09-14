import type { LoaderArgs } from '@remix-run/node'
import { authenticator } from '~/app/features/auth/services/authenticator.server'

export const loader = async ({ request }: LoaderArgs) =>
  await authenticator.authenticate('google', request, {
    successRedirect: '/',
    failureRedirect: '/login',
  })
