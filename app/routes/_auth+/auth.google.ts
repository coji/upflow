import { unstable_defineLoader as defineLoader } from '@remix-run/node'
import { $path } from 'remix-routes'
import { authenticator } from '~/app/features/auth/services/authenticator.server'

export const loader = defineLoader(
  async ({ request }) =>
    await authenticator.authenticate('google', request, {
      successRedirect: $path('/'),
      failureRedirect: $path('/login'),
    }),
)
