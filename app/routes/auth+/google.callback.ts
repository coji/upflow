import type { LoaderArgs } from '@remix-run/node'
import { authenticator } from '~/app/features/auth/services/authenticator.server'
import { createForwardedRequest } from '~/app/services/forwarded-request'

export const loader = async ({ request, context }: LoaderArgs) =>
  await authenticator.authenticate('google', createForwardedRequest(request), {
    successRedirect: '/',
    failureRedirect: '/login',
    context,
  })
