import type { LoaderFunctionArgs } from '@remix-run/node'
import { $path } from 'remix-routes'
import { authenticator } from '~/app/features/auth/services/authenticator.server'

export const loader = async ({ request }: LoaderFunctionArgs) =>
  await authenticator.authenticate('google', request, {
    successRedirect: $path('/'),
    failureRedirect: $path('/login'),
  })
